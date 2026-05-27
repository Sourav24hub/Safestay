import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface EmergencyAnalysis {
  isEmergency: boolean;
  isHousekeeping: boolean;
  category: 'Medical' | 'Fire' | 'Security' | 'Hazard' | 'Other';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  summary: string;
  suggestedAction: string;
  authoritiesToNotify: string[];
}

export function localHeuristicAnalysis(message: string): EmergencyAnalysis {
  const msg = message.toLowerCase().trim();
  
  // Custom definitions for emergency classification
  const housekeepingKeywords = [
    'towel', 'blanket', 'pillow', 'shampoo', 'soap', 'clean', 'housekeeping', 
    'room service', 'food', 'drink', 'water', 'ice', 'wifi', 'wi-fi', 'ac ', 
    'air conditioning', 'heater', 'remote', 'tv', 'television', 'toiletries', 
    'luggage', 'baggage', 'check out', 'checkout', 'check in', 'checkin', 
    'valet', 'parking', 'spoon', 'fork', 'plate', 'napkin', 'bulb', 'light bulb',
    'dust', 'iron', 'hair dryer', 'dirty', 'floor' // Added 'dirty' and 'floor' here
  ];
  
  const isHousekeeping = housekeepingKeywords.some(kw => msg.includes(kw));
  
  let category: 'Medical' | 'Fire' | 'Security' | 'Hazard' | 'Other' = 'Other';
  let severity: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  let suggestedAction = "Route to housekeeping / maintenance queue.";
  let authoritiesToNotify: string[] = [];
  
  // Fire incidents
  if (msg.includes('fire') || msg.includes('smoke') || msg.includes('burning') || msg.includes('explosion') || msg.includes('flame')) {
    category = 'Fire';
    severity = 'Critical';
    suggestedAction = "Activate nearest fire alarm pull station. Evacuate building immediately. Proceed to safely designated muster points.";
    authoritiesToNotify = ["Local Fire Department (Dispatched)"];
  } 
  // Medical incidents
  else if (msg.includes('heart') || msg.includes('bleed') || msg.includes('unconscious') || msg.includes('breathing') || msg.includes('stroke') || msg.includes('seizure') || msg.includes('allergic') || msg.includes('injury') || msg.includes('faint') || msg.includes('choking') || msg.includes('pain') || msg.includes('asthma') || msg.includes('collapse')) {
    category = 'Medical';
    severity = 'High';
    suggestedAction = "Retrieve standard First Aid/Medical Response Kit. Clear an access path for emergency EMT teams.";
    authoritiesToNotify = ["Emergency Medical Services (EMS)"];
  } 
  // Security incidents
  else if (msg.includes('fight') || msg.includes('theft') || msg.includes('weapon') || msg.includes('intruder') || msg.includes('rob') || msg.includes('assault') || msg.includes('harass') || msg.includes('suspicious') || msg.includes('break') || msg.includes('threat') || msg.includes('stole')) {
    category = 'Security';
    severity = 'High';
    suggestedAction = "Secure internal locks. Keep situational visual awareness if safe. Alert local law enforcement team.";
    authoritiesToNotify = ["Local Police Department"];
  } 
  // Hazard incidents
  else if (msg.includes('flood') || msg.includes('gas') || msg.includes('wire') || msg.includes('electric') || msg.includes('structural') || msg.includes('pipe') || msg.includes('toxic')) {
    // Removed general 'leak' and 'spill' to prevent minor shower leaks or floor spills from triggering hazards
    category = 'Hazard';
    severity = 'Medium';
    suggestedAction = "Isolate hazard section immediate border. Notify standby facility engineering team and isolate mains.";
    authoritiesToNotify = ["Building Engineers"];
  }

  // FIXED HEURISTIC LOGIC: It is an emergency ONLY if it matches a critical category and is NOT housekeeping
  const isEmergency = !isHousekeeping && category !== 'Other';

  return {
    isEmergency: isEmergency,
    isHousekeeping,
    category,
    severity,
    summary: message.substring(0, 60) + (message.length > 60 ? '...' : ''),
    suggestedAction,
    authoritiesToNotify
  };
}

export async function analyzeEmergency(message: string): Promise<EmergencyAnalysis> {
  if (!ai) {
    console.warn("GEMINI_API_KEY is not defined. Using client-side heuristic analyzer fallback.");
    return localHeuristicAnalysis(message);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analyze the following message from a hotel/restaurant guest. 
      Message: "${message}"`,
      config: {
        responseMimeType: "application/json",
        // FIXED: Added strict System Instructions with Few-Shot examples inside the config block
        systemInstruction: `You are a strict property management triage AI. Your sole job is to classify user requests into either EMERGENCY or ROUTINE HOUSEKEEPING.

CRITICAL RULES:
1. isEmergency must be true ONLY if there is an immediate, active threat to human life, safety, or severe property structural damage (e.g., active fires, medical crises, active crime, severe pipe burst flooding).
2. isHousekeeping must be true for ANY cleaning, comfort, routine service, or non-dangerous maintenance requests (e.g., dirty floor, spilled water, trash full, broken shower, AC not cooling, Wi-Fi down, need extra towels).
3. If isHousekeeping is true, isEmergency MUST be false.

FEW-SHOT EXAMPLES:
- "The floor is dirty in the hallway" -> isEmergency: false, isHousekeeping: true, category: "Other", severity: "Low"
- "My shower is not working" -> isEmergency: false, isHousekeeping: true, category: "Other", severity: "Low"
- "There is a fire in room 302" -> isEmergency: true, isHousekeeping: false, category: "Fire", severity: "Critical"
- "A guest collapsed and is unconscious" -> isEmergency: true, isHousekeeping: false, category: "Medical", severity: "High"`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isEmergency: { type: Type.BOOLEAN },
            isHousekeeping: { type: Type.BOOLEAN },
            category: { 
              type: Type.STRING, 
              enum: ['Medical', 'Fire', 'Security', 'Hazard', 'Other'] 
              },
            severity: { 
              type: Type.STRING, 
              enum: ['Low', 'Medium', 'High', 'Critical'] 
            },
            summary: { type: Type.STRING },
            suggestedAction: { type: Type.STRING },
            authoritiesToNotify: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
          },
          required: ['isEmergency', 'isHousekeeping', 'category', 'severity', 'summary', 'suggestedAction', 'authoritiesToNotify']
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to run/parse Gemini response. Falling back to local heuristic analyzer.", e);
    return localHeuristicAnalysis(message);
  }
}