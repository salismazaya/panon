package handlers

import (
	"sync"

	lua "github.com/yuin/gopher-lua"
)

// LuaPool manages a pool of lua.LState instances.
type LuaPool struct {
	pool    *sync.Pool
	states  chan *lua.LState
	maxSize int
}

// Global instance to be used by handlers
var GlobalLuaPool *LuaPool

// InitLuaPool initializes the global pool for Lua states with a specific size.
// It uses a channel to strictly limit the number of cached states.
func InitLuaPool(size int) {
	GlobalLuaPool = &LuaPool{
		states:  make(chan *lua.LState, size),
		maxSize: size,
		pool: &sync.Pool{
			New: func() interface{} {
				return lua.NewState()
			},
		},
	}
}

// Get retrieves a Lua state from the channel pool or creates a new one via sync.Pool.
func (p *LuaPool) Get() *lua.LState {
	if p == nil {
		L := lua.NewState()
		return L
	}

	select {
	case L := <-p.states:
		return L
	default:
		return p.pool.Get().(*lua.LState)
	}
}

// Put returns a Lua state to the channel pool for reuse, or closes it if full.
func (p *LuaPool) Put(L *lua.LState) {
	if L == nil || p == nil {
		return
	}

	// Basic cleanup: reset the stack.
	L.SetTop(0)

	select {
	case p.states <- L:
		// Successfully returned to channel pool
	default:
		// Channel pool is full, return to sync.Pool for general reuse
		// or Close if we want to be strict. sync.Pool is better for temporary spikes.
		p.pool.Put(L)
	}
}