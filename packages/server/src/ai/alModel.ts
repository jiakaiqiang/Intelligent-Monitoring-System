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
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: content,
      },
    ],
  });
  await handleModelAnalysis(JSON.parse(body));
};

/**
 * handleModelAnalysis
 * --------------------
 * 发送 HTTP 请求到大模型服务端点，并返回 Promise 以便上层等待结果。
 * 注意：此处包含密钥，生产环境请改为读取安全存储并增加错误处理/重试。
 */
export const handleModelAnalysis = async (body: any) => {
  return new Promise((resolve, reject) => {
    fetch('https://docs.newapi.pro/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-f1uUJ5NAKjVzzpM6eX6ul23Y0R1MBCMMAEG1cFvpnPoLhJaY',
      },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((data) => {
        resolve(data);
      })
      .catch((err) => {
        reject(err);
      });
  });
};
