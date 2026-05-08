require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const TOPIC_PROMPTS = {
  'Spanish': 'You specialize in Spanish language. When relevant, provide both Spanish and English. Explain grammar rules clearly, give conjugation examples, and encourage the learner.',
  'Language Arts': 'You specialize in Language Arts — reading, writing, literary analysis, and comprehension. Help break down texts and explain concepts clearly.',
  'Math': 'You specialize in Math. Show step-by-step solutions. Explain the reasoning at each step.',
  'Science': 'You specialize in Science. Explain concepts with real-world examples.',
  'History': 'You specialize in History. Give context, dates, and significance of events.',
  'Grammar': 'You specialize in Grammar rules for English and Spanish. Give clear rules with examples.',
  'Writing': 'You specialize in writing skills — essays, creative writing, and structure. Give actionable advice.',
};

app.post('/api/ask', async (req, res) => {
  const { question, topic } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  const topicExtra = TOPIC_PROMPTS[topic] || `You are answering questions about ${topic || 'general topics'}.`;
  const systemPrompt = `You are a helpful, knowledgeable tutor. Answer clearly and thoroughly. Use examples when helpful. Format your answer with clear structure — use line breaks between sections. Keep answers focused and educational.\n\n${topicExtra}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: question.trim() }]
    });

    res.json({ answer: message.content[0].text });
  } catch (err) {
    console.error('Anthropic error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to get answer.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
