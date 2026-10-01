from app.agents.provider import get_provider
from app.schemas.internal import AgentProposal, DebugContext


def run_defender(context: DebugContext) -> AgentProposal:
    return get_provider().generate_defender(context)
