import { GoogleGenAI, Type } from '@google/genai';
import { AIAnalysisResult, Department, IssueCategory, PriorityLevel } from '../src/types/civic.js';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export async function analyzeIssueWithGemini(
  reportedCategory: string,
  description: string,
  locationHint?: string
): Promise<AIAnalysisResult> {
  const ai = getAiClient();

  if (!ai) {
    console.warn('[Gemini] GEMINI_API_KEY is not configured. Using deterministic fallback analysis.');
    return getFallbackAnalysis(reportedCategory, description);
  }

  const prompt = `You are a municipal civic issue analyzer for a city administration.
Analyze the following citizen report strictly based on the text provided. Do NOT hallucinate or assume unstated facts.

User selected category: "${reportedCategory}"
Issue description: "${description}"
${locationHint ? `Location context: "${locationHint}"` : ''}

Tasks:
1. Validate or refine the category from this list:
   - Pothole
   - Damaged Road
   - Garbage / Waste
   - Waterlogging
   - Broken Streetlight
   - Blocked Drain
   - Sewage Problem
   - Fallen Tree
   - Encroachment
   - Other

2. Determine Severity (LOW, MEDIUM, HIGH, CRITICAL):
   - CRITICAL: immediate life/safety hazard, deep open manhole, high voltage sparking, collapsed road, major flooding near residences.
   - HIGH: severe traffic impediment, overflowing raw sewage, large tree fallen blocking roadway, wide pothole causing accidents.
   - MEDIUM: uncollected garbage dump, dark streetlight in residential lane, water stagnant on footpath, broken curb.
   - LOW: minor littering, graffiti, non-hazardous small pothole on quiet alley.

3. Determine Urgency (LOW, MEDIUM, HIGH, CRITICAL):
   - How rapidly municipal crews need to dispatch to mitigate active danger or damage.

4. Suggest the responsible municipal department from this list:
   - Roads & Infrastructure
   - Solid Waste Management
   - Water Supply & Sewerage
   - Electrical & Street Lighting
   - Stormwater Drainage
   - Horticulture & Trees
   - Town Planning & Enforcement
   - General Municipal Administration

5. Generate a concise 1-2 sentence factual summary.
6. Provide clear, honest reasoning explaining the severity/urgency without inventing any details.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are a precise, objective public works triage assistant. You return valid JSON only according to the specified schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: 'Refined civic category',
            },
            severity: {
              type: Type.STRING,
              description: 'LOW, MEDIUM, HIGH, or CRITICAL',
            },
            urgency: {
              type: Type.STRING,
              description: 'LOW, MEDIUM, HIGH, or CRITICAL',
            },
            suggested_department: {
              type: Type.STRING,
              description: 'Name of the responsible department',
            },
            concise_summary: {
              type: Type.STRING,
              description: 'Objective 1-2 sentence issue summary',
            },
            reasoning: {
              type: Type.STRING,
              description: 'Reasoning behind severity and urgency based strictly on user description',
            },
          },
          required: ['category', 'severity', 'urgency', 'suggested_department', 'concise_summary', 'reasoning'],
        },
      },
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    const parsed = JSON.parse(text);

    return {
      category: normalizeCategory(parsed.category || reportedCategory),
      severity: normalizePriority(parsed.severity),
      urgency: normalizePriority(parsed.urgency),
      suggested_department: normalizeDepartment(parsed.suggested_department, parsed.category || reportedCategory),
      concise_summary: parsed.concise_summary || description.slice(0, 140),
      reasoning: parsed.reasoning || 'Evaluated based on citizen reported hazard level and location context.',
    };
  } catch (error) {
    console.error('[Gemini] Analysis failed or timed out:', error);
    return getFallbackAnalysis(reportedCategory, description);
  }
}

function normalizePriority(val: any): PriorityLevel {
  const upper = String(val || '').toUpperCase();
  if (upper.includes('CRITICAL')) return 'CRITICAL';
  if (upper.includes('HIGH')) return 'HIGH';
  if (upper.includes('LOW')) return 'LOW';
  return 'MEDIUM';
}

function normalizeCategory(cat: string): IssueCategory {
  const c = (cat || '').toLowerCase();
  if (c.includes('pothole')) return 'Pothole';
  if (c.includes('road')) return 'Damaged Road';
  if (c.includes('garbage') || c.includes('waste') || c.includes('trash')) return 'Garbage / Waste';
  if (c.includes('waterlog') || c.includes('flood')) return 'Waterlogging';
  if (c.includes('light') || c.includes('lamp') || c.includes('electric')) return 'Broken Streetlight';
  if (c.includes('drain')) return 'Blocked Drain';
  if (c.includes('sewage') || c.includes('manhole')) return 'Sewage Problem';
  if (c.includes('tree') || c.includes('branch')) return 'Fallen Tree';
  if (c.includes('encroach')) return 'Encroachment';
  return 'Other';
}

function normalizeDepartment(dept: string, category: string): Department {
  const d = (dept || '').toLowerCase();
  if (d.includes('waste') || d.includes('sanitation')) return 'Solid Waste Management';
  if (d.includes('water') || d.includes('sewer')) return 'Water Supply & Sewerage';
  if (d.includes('drain')) return 'Stormwater Drainage';
  if (d.includes('electric') || d.includes('light')) return 'Electrical & Street Lighting';
  if (d.includes('horticulture') || d.includes('tree') || d.includes('park')) return 'Horticulture & Trees';
  if (d.includes('planning') || d.includes('enforce')) return 'Town Planning & Enforcement';
  if (d.includes('road') || d.includes('infra')) return 'Roads & Infrastructure';

  // Fallback map from category
  const cat = normalizeCategory(category);
  switch (cat) {
    case 'Pothole':
    case 'Damaged Road':
      return 'Roads & Infrastructure';
    case 'Garbage / Waste':
      return 'Solid Waste Management';
    case 'Waterlogging':
    case 'Blocked Drain':
      return 'Stormwater Drainage';
    case 'Broken Streetlight':
      return 'Electrical & Street Lighting';
    case 'Sewage Problem':
      return 'Water Supply & Sewerage';
    case 'Fallen Tree':
      return 'Horticulture & Trees';
    case 'Encroachment':
      return 'Town Planning & Enforcement';
    default:
      return 'General Municipal Administration';
  }
}

export function getFallbackAnalysis(category: string, description: string): AIAnalysisResult {
  const cat = normalizeCategory(category);
  const text = (description || '').toLowerCase();

  let severity: PriorityLevel = 'MEDIUM';
  let urgency: PriorityLevel = 'MEDIUM';

  if (text.includes('urgent') || text.includes('danger') || text.includes('sparking') || text.includes('accident') || text.includes('injury') || text.includes('flood') || text.includes('deep')) {
    severity = 'HIGH';
    urgency = 'HIGH';
  }
  if (text.includes('critical') || text.includes('fire') || text.includes('electrocution') || text.includes('school children') || text.includes('hospital')) {
    severity = 'CRITICAL';
    urgency = 'CRITICAL';
  }
  if (text.includes('minor') || text.includes('small') || text.includes('cosmetic')) {
    severity = 'LOW';
    urgency = 'LOW';
  }

  return {
    category: cat,
    severity,
    urgency,
    suggested_department: normalizeDepartment('', cat),
    concise_summary: description.length > 100 ? `${description.slice(0, 97)}...` : description,
    reasoning: `Rule-based triage applied based on category "${cat}" and safety keywords in the description.`,
  };
}
