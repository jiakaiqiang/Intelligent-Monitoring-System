/**
 * 默认使用的对话式 AI 模型，方便统一切换。
 */
export const AI_MODEL = 'gpt-4';

/**
 * modelAnalysis
 * --------------
 * 包装对大模型的调用，构造标准的 messages payload 并委托给 `handleModelAnalysis`。
 */
export const modelAnalysis = async (content: string) => {
  console.log(content, 'content');
  const body = JSON.stringify({
    model: 'deepseek-v3',
    group: 'default',
    stream: true,
    messages: [
      {
        role: 'user',
        content: content,
      },
    ],
  });
  return handleModelAnalysis(body);
};

/**
 * handleModelAnalysis
 * --------------------
 * 发送 HTTP 请求到大模型服务端点，并返回 Promise 以便上层等待结果。
 * 注意：此处包含密钥，生产环境请改为读取安全存储并增加错误处理/重试。
 */
export const handleModelAnalysis = async (body: any) => {
  console.log(body, 'body');
  const response = await fetch('https://ai.huan666.de/v1/chat/completions', {
    method: 'POST',
    headers: {
      
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-YgKDdUm8YjvgDJLsw08FuhxnlWAXIyUSfJEXGjZ16fuAD7bq',
    },
    body,
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`模型调用失败：${response.status} ${errorPayload}`);
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
        const delta = parsed?.choices?.[0]?.delta?.content || '';
        content += delta;
      } catch (error) {
        console.error('解析流数据失败', error);
      }
    }
  }

  if (buffer.trim()) {
    try {
      const payload = buffer.replace(/^data:\s*/, '');
      const parsed = JSON.parse(payload);
      content += parsed?.choices?.[0]?.delta?.content || '';
    } catch (error) {
      console.error('解析剩余流数据失败', error);
    }
  }

  return content;
};
