package listener

import (
	"context"
	"encoding/json"
	"log"
	"regexp"
	"strings"
	"sync"

	"github.com/robfig/cron/v3"
	"github.com/salismazaya/panon/internal/models"
)

var cronRegex = regexp.MustCompile(`--\s*cron:\s*([^\n\r]+)[\s\S]*?function\s+(on_cron_[a-zA-Z0-9_]+)`)

type CronManager struct {
	cron     *cron.Cron
	entries  map[uint][]cron.EntryID // workspaceID -> entryIDs
	mu       sync.Mutex
	executor func(context.Context, models.ExecutorInput)
}

func NewCronManager(executor func(context.Context, models.ExecutorInput)) *CronManager {
	// Custom parser to support both 5 fields (standard) and 6 fields (with seconds)
	parser := cron.NewParser(
		cron.SecondOptional | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
	)
	c := cron.New(cron.WithParser(parser))
	c.Start()
	return &CronManager{
		cron:     c,
		entries:  make(map[uint][]cron.EntryID),
		executor: executor,
	}
}

func (cm *CronManager) RegisterWorkspace(workspace models.Workspace) {
	cm.UnregisterWorkspace(workspace.ID)

	cm.mu.Lock()
	defer cm.mu.Unlock()

	var flow struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal([]byte(workspace.FlowState), &flow); err != nil {
		log.Printf("❌ Failed to unmarshal flow state for workspace %d: %v", workspace.ID, err)
		return
	}

	matches := cronRegex.FindAllStringSubmatch(flow.Code, -1)
	for _, match := range matches {
		if len(match) < 3 {
			continue
		}
		spec := strings.TrimSpace(match[1])
		fnName := match[2]

		log.Printf("⏰ Registering cron for workspace %d: %s (%s)", workspace.ID, spec, fnName)

		entryID, err := cm.cron.AddFunc(spec, func() {
			log.Printf("🚀 Executing cron %s for workspace %d", fnName, workspace.ID)
			cm.executor(context.Background(), models.ExecutorInput{
				Workspace:  workspace,
				CronFnName: fnName,
			})
		})

		if err != nil {
			log.Printf("❌ Failed to register cron %s: %v", spec, err)
			continue
		}

		cm.entries[workspace.ID] = append(cm.entries[workspace.ID], entryID)
	}
}

func (cm *CronManager) UnregisterWorkspace(workspaceID uint) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	ids, ok := cm.entries[workspaceID]
	if !ok {
		return
	}

	for _, id := range ids {
		cm.cron.Remove(id)
	}
	delete(cm.entries, workspaceID)
}
