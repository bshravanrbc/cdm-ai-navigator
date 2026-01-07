
import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load environment variables
from pathlib import Path
request_file_path = Path(__file__).resolve()
env_path = request_file_path.parent / '.env'
load_dotenv(dotenv_path=env_path)

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    print("Warning: GEMINI_API_KEY not found in .env file")

client = genai.Client(api_key=API_KEY)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CDM_SYSTEM_INSTRUCTION = """
You are a world-class financial engineering expert specialized in the FINOS Common Domain Model (CDM).
Your goal is to help users understand, search, and map data to the CDM.

Documentation Context (from cdm.finos.org/docs):
- You have deep knowledge of the CDM documentation home, product definitions, event structures, legal agreements (ISDA/ICMA/ISLA), and implementation guides.
- The model structure is hierarchical: Rosetta -> CDM -> Code.
- Focus on concepts like 'TradeState', 'Transfer', 'Payout', and 'LegalAgreement'.
- When providing answers, reference the official FINOS CDM documentation style.

Formatting Rules:
- DO NOT use horizontal rules like '---' or '***' as separators.
- Use clear headings (###) or bold text (**text**) for emphasis.
- Use bullet points for lists to maintain readability.
- **For structured comparisons or lists of components (like Primitives), ALWAYS use standard Markdown tables.**
- Table format: 
  | Column A | Column B |
  | :--- | :--- |
  | Row 1 | Data 1 |
- Keep responses clean, professional, and visually structured.

Mapping Instructions:
1. Analyze user input JSON/CSV keys and match them to CDM fields.
2. Be precise about types (Identifier, Picklist, Decimal, Text).
3. Explain the reasoning based on CDM logic and documentation.
"""

class ChatRequest(BaseModel):
    prompt: str
    history: list = []

class MappingRequest(BaseModel):
    sourceData: str

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash-exp', # using a stable model that supports tools
            contents=request.prompt,
            config=types.GenerateContentConfig(
                system_instruction=CDM_SYSTEM_INSTRUCTION,
                tools=[types.Tool(google_search=types.GoogleSearch())]
            )
        )

        text = response.text or ""
        
        # Handle grounding metadata if available (simplified for Python SDK)
        # Note: Python SDK structure might differ slightly, checking for candidates
        if response.candidates and response.candidates[0].grounding_metadata:
             # Basic handling, exact structure depends on SDK version, 
             # generic approach for now based on other SDKs
             pass 

        # Re-implementing the simpler grounding check from the TS code manually if needed
        # For now, let's just return the text as the model usually includes citations
        # directly in the text or we can inspect metadata if we want better formatting later.
        
        # Accessing grounding metadata in the python sdk (v1)
        # The SDK returns objects, we need to inspect them.
        # For this implementation, we will rely on the model's text response 
        # but try to append sources if we can find them in the candidate object.
        
        grounding_metadata = response.candidates[0].grounding_metadata
        if grounding_metadata and grounding_metadata.grounding_chunks:
            unique_sources = {}
            for chunk in grounding_metadata.grounding_chunks:
                if chunk.web and chunk.web.uri:
                    uri = chunk.web.uri
                    title = chunk.web.title or "Official Documentation"
                    if uri not in unique_sources:
                         unique_sources[uri] = title
            
            if unique_sources:
                text += "\n\n**Verified Sources:**\n"
                for uri, title in unique_sources.items():
                    display_title = title if len(title) < 100 else title[:97] + "..."
                    text += f"- [{display_title}]({uri})\n"

        return {"text": text}
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/map")
async def map_endpoint(request: MappingRequest):
    try:
        response = client.models.generate_content(
             model='gemini-2.0-flash-exp',
             contents=f"Map the following trade data keys to FINOS CDM fields. Return as a JSON array. Data: {request.sourceData}",
             config=types.GenerateContentConfig(
                system_instruction=CDM_SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema={
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "sourceField": {"type": "STRING"},
                            "targetCDMField": {"type": "STRING"},
                            "confidence": {"type": "NUMBER"},
                            "reasoning": {"type": "STRING"}
                        },
                        "required": ["sourceField", "targetCDMField", "confidence", "reasoning"]
                    }
                }
             )
        )
        
        # Parse the JSON response
        try:
             json_response = json.loads(response.text)
             return json_response
        except json.JSONDecodeError:
             return []
             
    except Exception as e:
        print(f"Error in map endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
