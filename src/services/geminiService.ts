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
  
  // Housekeeping terms
  const housekeepingKeywords = [
    'towel', 'blanket', 'pillow', 'shampoo', 'soap', 'clean', 'housekeeping', 
    'room service', 'food', 'drink', 'water', 'ice', 'wifi', 'wi-fi', 'ac ', 
    'air conditioning', 'heater', 'remote', 'tv', 'television', 'toiletries', 
    'luggage', 'baggage', 'check out', 'checkout', 'check in', 'checkin', 
    'valet', 'parking', 'spoon', 'fork', 'plate', 'napkin', 'bulb', 'light bulb',
    'dust', 'iron', 'hair dryer', 'dirty', 'floor'
  ];
  
  // CRITICAL: Even if housekeeping words exist, checking for overriding medical/emergency signs
  const hasSevereMedicalSigns = msg.includes('breath') || msg.includes('foam') || msg.includes('mouth') || msg.includes('unconscious') || msg.includes('chok') || msg.includes('bleed');
  
  const isHousekeeping = housekeepingKeywords.some(kw => msg.includes(kw)) && !hasSevereMedicalSigns;
  
  let category: 'Medical' | 'Fire' | 'Security' | 'Hazard' | 'Other' = 'Other';
  let severity: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  let suggestedAction = "Route to housekeeping / maintenance queue.";
  let authoritiesToNotify: string[] = [];
  
  // Medical incidents (Expanded to handle breathing issues, foam, overdose, poisoning)
  if (msg.includes('heart') || msg.includes('bleed') || msg.includes('unconscious') || 
      msg.includes('breath') || msg.includes('stroke') || msg.includes('seizure') || 
      msg.includes('allergic') || msg.includes('injury') || msg.includes('faint') || 
      msg.includes('chok') || msg.includes('pain') || msg.includes('asthma') || 
      msg.includes('collapse') || msg.includes('foam') || msg.includes('mouth') || msg.includes('poison')) {
    
    category = 'Medical';
    severity = msg.includes('breath') || msg.includes('foam') ? 'Critical' : 'High';
    suggestedAction = "Perform immediate CPR if trained and breath is absent. If foam or vomiting is present, turn the person on their side (recovery position) to prevent choking. Clear access for EMS.";
    authoritiesToNotify = ["Emergency Medical Services (EMS)"];
  } 
  // Fire incidents
  else if (msg.includes('fire') || msg.includes('smoke') || msg.includes('burning') || msg.includes('explosion') || msg.includes('flame')) {
    category = 'Fire';
    severity = 'Critical';
    suggestedAction = "Activate nearest fire alarm pull station. Evacuate building immediately.";
    authoritiesToNotify = ["Local Fire Department (Dispatched)"];
  } 
  // Security incidents
  else if (msg.includes('fight') || msg.includes('theft') || msg.includes('weapon') || msg.includes('intruder') || msg.includes('rob') || msg.includes('assault') || msg.includes('harass') || msg.includes('threat')) {
    category = 'Security';
    severity = 'High';
    suggestedAction = "Secure internal locks. Alert local law enforcement team.";
    authoritiesToNotify = ["Local Police Department"];
  } 
  // Hazard incidents
  else if (msg.includes('flood') || msg.includes('gas') || msg.includes('wire') || msg.includes('electric') || msg.includes('structural') || msg.includes('pipe')) {
    category = 'Hazard';
    severity = 'Medium';
    suggestedAction = "Isolate hazard section. Notify engineering team.";
    authoritiesToNotify = ["Building Engineers"];
  }

  const isEmergency = category !== 'Other';

  return {
    isEmergency,
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
      contents: `Analyze the following message from a guest/user. 
      Message: "${message}"`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: `You are a smart property management and safety triage AI. Your job is to classify requests into either EMERGENCY or ROUTINE HOUSEKEEPING. 

Be highly sensitive to medical emergencies. If a request indicates a person is in physical distress, unconscious, having trouble breathing, or showing severe symptoms, it MUST be classified as an EMERGENCY, even if the text uses informal wording or mentions things like drinking.

CRITICAL RULES:
1. isEmergency must be true if there is any active threat to human life, safety, or severe medical distress (e.g., not breathing, passing out, foaming at the mouth, bleeding, poisoning/overdose signs).
2. isHousekeeping must be true ONLY for cleaning, comfort, or minor maintenance requests that carry zero risk to life (e.g., dirty floor, spilled water, trash full, broken shower, AC cooling issue).
3. If a message contains a severe medical issue, it takes absolute priority over any housekeeping keywords.

FEW-SHOT EXAMPLES:
- "My friend has been drinking online and now foam is coming out of his mouth" -> isEmergency: true, isHousekeeping: false, category: "Medical", severity: "Critical"
- "Help my friend is not breathing" -> isEmergency: true, isHousekeeping: false, category: "Medical", severity: "Critical"
- "The floor is dirty in the hallway" -> isEmergency: false, isHousekeeping: true, category: "Other", severity: "Low"
- "My shower is leaking water onto the bathroom floor" -> isEmergency: false, isHousekeeping: true, category: "Other", severity: "Low"`,
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