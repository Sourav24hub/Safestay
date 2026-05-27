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
    'dust', 'iron', 'hair dryer'
  ];
  
  const isHousekeeping = housekeepingKeywords.some(kw => msg.includes(kw));
  
  let category: 'Medical' | 'Fire' | 'Security' | 'Hazard' | 'Other' = 'Other';
  let severity: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  let suggestedAction = "Contact management immediately for critical review.";
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
  else if (msg.includes('flood') || msg.includes('leak') || msg.includes('gas') || msg.includes('wire') || msg.includes('electric') || msg.includes('structural') || msg.includes('pipe') || msg.includes('spill') || msg.includes('toxic')) {
    category = 'Hazard';
    severity = 'Medium';
    suggestedAction = "Isolate hazard section immediate border. Notify standby facility engineering team and isolate mains.";
    authoritiesToNotify = ["Building Engineers"];
  }

  // Determine if it qualifies as an emergency
  const isEmergency = !isHousekeeping && (
    category !== 'Other' || 
    msg.includes('urgent') || 
    msg.includes('emergency') || 
    msg.includes('help') || 
    msg.includes('danger') || 
    msg.includes('hurt') ||
    msg.length > 5 // Non-empty message that isn't housekeeping
  );

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
      model: "gemini-2.5-flash", // Update to a modern stable flash model as default
      contents: `Analyze the following message from a hotel/restaurant guest. 
      Message: "${message}"
      
      Strictly classify this message:
      1. isEmergency: True ONLY if there is an immediate threat to life, safety, or property (e.g., fire, medical collapse, active crime, major flood).
      2. isHousekeeping: True if the request is for routine services like towels, cleaning, room service, extra pillows, or non-urgent maintenance.
      
      If it is housekeeping or a routine service request, isEmergency MUST be false.`,
      config: {
        responseMimeType: "application/json",
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
