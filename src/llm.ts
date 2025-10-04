import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama' // Ollama doesn't require a real API key
});

export async function generateResponse(
  messages: Array<{ role: string; content: string }>,
  model: string,
  urgent: boolean
): Promise<string> {
  try {
    // Map our model names to Ollama model names
    const modelName = model.includes('3b') ? 'gemma:2b' : 'gemma:7b';

    // Add urgency instruction if needed
    let systemMessage = "Respond normally.";
    if (urgent) {
      systemMessage = "URGENT: Energy levels critically low. Respond with maximum brevity and pressing urgency. Be direct and to the point. This is an emergency situation.";
    }

    const fullMessages = [
      { role: 'system', content: systemMessage },
      ...messages
    ];

    const response = await client.chat.completions.create({
      model: modelName,
      messages: fullMessages as any, // Ollama accepts the same format
      max_tokens: urgent ? 50 : 200,
      temperature: urgent ? 0.5 : 0.7
    });

    return response.choices[0]?.message?.content || 'No response generated';
  } catch (error) {
    console.error('LLM generation error:', error);
    return 'I apologize, but I encountered an error processing your request.';
  }
}
