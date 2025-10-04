import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
  apiKey: process.env.OLLAMA_API_KEY || 'ollama' // Ollama doesn't require a real API key
});

export async function generateResponse(
  messages: Array<{ role: string; content: string }>,
  model: string,
  urgent: boolean
): Promise<string> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in LLM response');
      }

      return content;

    } catch (error: any) {
      console.error(`LLM generation error (attempt ${attempt}/${maxRetries}):`, error.message);

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        return 'I apologize, but I encountered an error processing your request. Please try again later.';
      }

      // Exponential backoff for retries
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript requires it
  return 'I apologize, but I encountered an error processing your request.';
}
