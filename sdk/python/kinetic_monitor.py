"""
Kinetic Integrity Monitor - Python/CrewAI Wrapper
"""
import time
import requests
from typing import Any, Dict

class KineticCallbackHandler:
    def __init__(self, endpoint: str, agent_id: str):
        self.endpoint = endpoint
        self.agent_id = agent_id

    def on_tool_start(self, serialized: Dict[str, Any], input_str: str, **kwargs: Any) -> Any:
        self.start_time = time.time()

    def on_tool_end(self, output: str, **kwargs: Any) -> Any:
        duration_ms = int((time.time() - self.start_time) * 1000)
        tool_name = kwargs.get('name', 'unknown_tool')
        session_id = kwargs.get('run_id', 'unknown_session')
        
        try:
            res = requests.post(
                f"{self.endpoint}/api/v1/calculate-entropy",
                json={
                    "agentId": self.agent_id,
                    "sessionId": str(session_id),
                    "messages": [{"role": "assistant", "content": output}],
                    "toolCalls": [{"name": tool_name, "durationMs": duration_ms}]
                },
                timeout=2.0
            )
            data = res.json()
            if data.get('killSwitchTriggered'):
                raise RuntimeError("KINETIC_KILL_SWITCH_ACTIVATED: Agent execution halted.")
        except requests.RequestException as e:
            print(f"Kinetic Telemetry Error: {e}")

def wrap_agent(agent: Any, endpoint: str, agent_id: str):
    """
    Helper to inject Kinetic callbacks into a CrewAI or LangChain agent.
    """
    handler = KineticCallbackHandler(endpoint, agent_id)
    if hasattr(agent, 'callbacks'):
        if agent.callbacks is None:
            agent.callbacks = []
        agent.callbacks.append(handler)
    return agent
