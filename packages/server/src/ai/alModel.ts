export const AI_MODEL = 'gpt-4';
//模型分析
export const modelAnalysis = async (content: string) => {
    console.log(content,'content')
   const body =  JSON.stringify({
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content":content
    }
  ]
})
await handleModelAnalysis(JSON.parse(body))

}
export const handleModelAnalysis = async (body: any) => {
    return new Promise((resolve, reject) => {
        fetch("https://docs.newapi.pro/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer sk-f1uUJ5NAKjVzzpM6eX6ul23Y0R1MBCMMAEG1cFvpnPoLhJaY"
            },
            body: JSON.stringify(body)
        }).then(res => res.json()).then(data => {
            resolve(data)
        }).catch(err => {
            reject(err)
        })
    })
}