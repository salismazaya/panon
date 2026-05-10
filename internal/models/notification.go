package models

type Notification struct {
	WorkspaceID uint    `json:"workspaceId"`
	Name        string  `json:"name"`
	Amount      float64 `json:"amount"`
	Sender      string  `json:"sender"`
	Signature   string  `json:"signature"`
}

type ExecutorInput struct {
	Workspace      Workspace
	Signature      string
	SolAmountIn    float64
	TokenAmountIn  float64
	TokenMint      string
	Signer         string
	CronFnName     string
}
