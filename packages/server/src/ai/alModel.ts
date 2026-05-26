export const AI_MODEL = process.env.AI_MODEL || 'deepseek-v3';

const AI_API_BASE_URL = process.env.AI_API_BASE_URL || 'https://ai.huan666.de/v1/chat/completions';
const AI_GROUP = process.env.AI_GROUP || 'default';

export const modelAnalysis = async (content: string) => {
  const body = JSON.stringify({
    model: AI_MODEL,
    group: AI_GROUP,
    stream: true,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  });

  return handleModelAnalysis(body);
};

export const handleModelAnalysis = async (body: string) => {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured');
  }

  const response = await fetch(AI_API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`AI model request failed: ${response.status} ${errorPayload}`);
  }

  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split('\n\n');
    buffer = segments.pop() || '';

    for (const segment of segments) {
      const line = segment.trim();
      if (!line.startsWith('data:')) {
        continue;
      }

      const payload = line.replace(/^data:\s*/, '');
      if (!payload || payload === '[DONE]') {
        continue;
      }

      try {
        const parsed = JSON.parse(payload);
        content += parsed?.choices?.[0]?.delta?.content || '';
      } catch (error) {
        console.error('Failed to parse AI stream segment:', error);
      }
    }
  }

  if (buffer.trim()) {
    try {
      const payload = buffer.replace(/^data:\s*/, '');
      const parsed = JSON.parse(payload);
      content += parsed?.choices?.[0]?.delta?.content || '';
    } catch (error) {
      console.error('Failed to parse remaining AI stream data:', error);
    }
  }

  return content;
};
