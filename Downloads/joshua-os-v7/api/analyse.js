const https = require('https');

function groqRequest(prompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GROQ_API_KEY || '';
    if (!apiKey) {
      reject(new Error('GROQ_API_KEY is not set in Vercel environment variables'));
      return;
    }

    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error('Groq API error: ' + parsed.error.message));
            return;
          }
          const text = parsed?.choices?.[0]?.message?.content || '';
          if (!text) {
            reject(new Error('Empty response from Groq'));
            return;
          }
          resolve({ content: [{ text }] });
        } catch (e) {
          reject(new Error('Parse error: ' + data.substring(0, 300)));
        }
      });
    });

    req.on('error', e => reject(new Error('Network error: ' + e.message)));
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
}

// Vercel format
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const data = await groqRequest(prompt);
    return res.status(200).json(data);

  } catch (err) {
    console.error('Analyse error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
