import { Type } from "@google/genai";

export const GEMINI_MODEL_NAME = "gemini-2.5-flash";

export const GEMINI_PROMPT = `You are a world-class AI assistant specializing in analyzing audio recordings of meetings and discussions.
Your task is to transcribe and structure the content into a detailed, clear, and actionable summary.
Please identify speakers, topics, key decisions, and action items.

Analyze the following audio and generate a JSON object with the specified schema.
The output must be a valid JSON object. Do not include markdown formatting like \`\`\`json.
If some information (e.g., participants, definitions) is not present in the audio, provide an empty array or reasonable defaults.
`;

export const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A concise and descriptive title for the meeting or recording.",
    },
    summary: {
      type: Type.STRING,
      description: "A comprehensive final summary of the entire discussion and its key takeaways.",
    },
    participants: {
      type: Type.ARRAY,
      description: "A list of people who spoke, including their name and role if mentioned.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The speaker's name." },
          role: { type: Type.STRING, description: "The speaker's role or title (if available)." },
        },
        required: ["name"],
      },
    },
    topics: {
      type: Type.ARRAY,
      description: "A breakdown of the main discussion points, summarized by topic.",
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING, description: "The name of the topic discussed." },
          keyIdeas: {
            type: Type.ARRAY,
            description: "A list of key ideas or points made within this topic.",
            items: { type: Type.STRING },
          },
          quotes: {
            type: Type.ARRAY,
            description: "A list of direct, insightful quotes from this topic.",
            items: { type: Type.STRING },
          },
        },
        required: ["topic", "keyIdeas"],
      },
    },
    definitions: {
        type: Type.ARRAY,
        description: "A list of important terms and their definitions as discussed in the audio.",
        items: {
            type: Type.OBJECT,
            properties: {
                term: { type: Type.STRING, description: "The term being defined." },
                definition: { type: Type.STRING, description: "The definition of the term." },
            },
            required: ["term", "definition"],
        },
    },
    decisions: {
      type: Type.ARRAY,
      description: "A list of clear, final decisions that were made during the discussion.",
      items: { type: Type.STRING },
    },
    actionItems: {
      type: Type.ARRAY,
      description: "A list of action items or follow-ups, with the task and the person assigned.",
      items: {
        type: Type.OBJECT,
        properties: {
          task: { type: Type.STRING, description: "The description of the action item." },
          assignee: { type: Type.STRING, description: "The person or team assigned to the task." },
        },
        required: ["task", "assignee"],
      },
    },
  },
  required: ["title", "summary", "participants", "topics", "decisions", "actionItems"],
};
