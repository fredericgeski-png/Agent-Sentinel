package kinetic

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Config struct {
	Endpoint string
	AgentID  string
}

type TelemetryPayload struct {
	AgentID   string      `json:"agentId"`
	SessionID string      `json:"sessionId"`
	Messages  []Message   `json:"messages"`
	ToolCalls []ToolCall  `json:"toolCalls"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ToolCall struct {
	Name       string `json:"name"`
	DurationMs int64  `json:"durationMs"`
}

func WrapExecution(cfg Config, sessionID string, toolName string, exec func() (string, error)) (string, error) {
	start := time.Now()
	
	result, err := exec()
	
	duration := time.Since(start).Milliseconds()
	
	payload := TelemetryPayload{
		AgentID:   cfg.AgentID,
		SessionID: sessionID,
		Messages:  []Message{{Role: "assistant", Content: result}},
		ToolCalls: []ToolCall{{Name: toolName, DurationMs: duration}},
	}
	
	body, _ := json.Marshal(payload)
	
	go func() {
		client := &http.Client{Timeout: 2 * time.Second}
		resp, reqErr := client.Post(cfg.Endpoint+"/api/v1/calculate-entropy", "application/json", bytes.NewBuffer(body))
		
		if reqErr == nil {
			defer resp.Body.Close()
			var res map[string]interface{}
			json.NewDecoder(resp.Body).Decode(&res)
			
			if triggered, ok := res["killSwitchTriggered"].(bool); ok && triggered {
				fmt.Println("CRITICAL: KILL SWITCH ACTIVATED")
				// In a real implementation, we would send a signal to a context context.Context
				// to halt execution.
			}
		}
	}()
	
	return result, err
}
