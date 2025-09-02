# # pfas_agent.py
# # A thin wrapper around agent_starter that adds PFAS context and a suggested prompt template.

# import argparse
# from agent_starter import minimal_research_agent, load_env

# PREFACE = (
#     "You are an environmental engineering analyst. Focus on PFAS drinking water guidance, "
#     "treatment (GAC, IX, RO), EBCT/design factors, lifecycle costs, and recent policy changes."
# )

# TEMPLATE_HINTS = """
# When answering:
# - Distinguish PFOA/PFOS vs total PFAS limits by region and date.
# - Compare GAC vs Ion Exchange (resin type, EBCT, breakthrough, Opex/Capex).
# - Note any 2023–2025 regulation updates (UK DWI, EU, US EPA).
# - Summarize 2–3 vendor datasheets or case studies when available.
# - Provide bullet points + short table-style comparisons when useful.
# - Cite URLs inline.
# """

# if __name__ == "__main__":
#     load_env()
#     ap = argparse.ArgumentParser()
#     ap.add_argument("--query", required=True, help="PFAS question (string)")
#     ap.add_argument("--save", help="Optional: file to save (e.g., PFAS_brief.md)")
#     args = ap.parse_args()

#     q = f"{PREFACE}\n\nUser question: {args.query}\n\nGuidance:\n{TEMPLATE_HINTS}"
#     answer = minimal_research_agent(q, save=args.save)
#     print("\n=== PFAS ANSWER ===\n")
#     print(answer)
