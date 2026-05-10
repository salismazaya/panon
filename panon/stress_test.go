package panon

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/yuin/gopher-lua"
)

// TestStress_Concurrency melakukan banyak transaksi simulasi secara bersamaan
func TestStress_Concurrency(t *testing.T) {
	ensureValidator(t)

	sender := newFundedClient(t)
	numWorkers := 5 // Menggunakan 5 untuk menghindari rate limit validator lokal yang terlalu ketat
	var wg sync.WaitGroup
	errorsChan := make(chan error, numWorkers)

	t.Logf("Starting stress test with %d concurrent workers...", numWorkers)

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			L := lua.NewState()
			defer L.Close()
			sender.Client.Register(L)

			receiver := newAddress(t)
			script := fmt.Sprintf(`transfer("%s", "SOL", 0.01)`, receiver)

			if err := L.DoString(script); err != nil {
				errorsChan <- fmt.Errorf("[Worker %d] Failed: %v", id, err)
			}
		}(i)
	}

	wg.Wait()
	close(errorsChan)

	failCount := 0
	for err := range errorsChan {
		t.Errorf("%v", err)
		failCount++
	}

	t.Logf("Stress test completed. Failures: %d/%d", failCount, numWorkers)
}

// TestStress_MemoryIsolation memastikan tidak ada kebocoran data antar workspace
func TestStress_MemoryIsolation(t *testing.T) {
	// Memerlukan Redis berjalan
	if sender := newFundedClient(t); sender.Client.RedisClient == nil {
		t.Skip("Redis not available, skipping isolation test")
	}

	sender := newFundedClient(t)
	c1 := New(context.Background(), sender.Client.RPCClient, sender.PrivateKey.String(), sender.Client.RedisClient, 101, "")
	c2 := New(context.Background(), sender.Client.RPCClient, sender.PrivateKey.String(), sender.Client.RedisClient, 102, "")

	L1 := lua.NewState(); defer L1.Close()
	L2 := lua.NewState(); defer L2.Close()

	c1.Register(L1)
	c2.Register(L2)

	// L1 menulis data
	if err := L1.DoString(`setMemory("key", "VAL_WS_101")`); err != nil {
		t.Fatalf("L1 failed to set: %v", err)
	}

	// L2 membaca data dengan key yang sama
	if err := L2.DoString(`res = getMemory("key")`); err != nil {
		t.Fatalf("L2 failed to get: %v", err)
	}

	res := L2.GetGlobal("res")
	if res != lua.LNil {
		t.Errorf("Isolation Failure: Workspace 102 could read data from 101. Got: %v", res)
	} else {
		t.Log("Isolation Success: Workspace data is separated properly.")
	}
}
