require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOPIC_PROMPTS = {
  'Spanish': 'You specialize in Spanish language. When relevant, provide both Spanish and English. Explain grammar rules clearly and give conjugation examples.',
  'Language Arts': 'You specialize in Language Arts — reading, writing, literary analysis, and comprehension.',
  'Math': 'You specialize in Math. Show step-by-step solutions and explain the reasoning at each step.',
  'Science': 'You specialize in Science. Explain concepts with real-world examples.',
  'History': 'You specialize in History. Give context, dates, and significance of events.',
  'Grammar': 'You specialize in Grammar rules. Give clear rules with examples.',
  'Writing': 'You specialize in writing skills — essays, creative writing, and structure.',
  'Geography': 'You specialize in Geography. Include locations, facts, and context.',
  'Biology': 'You specialize in Biology. Use accurate terminology and clear explanations.',
};

app.post('/api/ask', async (req, res) => {
  const { question, topic, length, format, difficulty, tone, language, examples, followup, funfact, summary, mnemonic, commonmistakes } = req.body;

  if (!question?.trim()) return res.status(400).json({ error: 'Question is required.' });

  const topicExtra = TOPIC_PROMPTS[topic] || `You are answering questions about ${topic || 'general topics'}.`;

  const extras = [];
  if (examples)       extras.push('Include at least one real-world example.');
  if (funfact)        extras.push('End with an interesting fun fact related to the topic.');
  if (summary)        extras.push('End with a short TL;DR summary (1-2 sentences).');
  if (mnemonic)       extras.push('Include a memory trick or mnemonic to help remember the key concept.');
  if (commonmistakes) extras.push('Point out 1-2 common mistakes people make about this topic.');
  if (followup)       extras.push('At the very end, suggest 2-3 follow-up questions the student could explore.');

  const systemPrompt = `You are a helpful tutor. ${topicExtra}

Answer in ${language}.
Write the answer as ${format}.
Keep the answer to ${length}.
Write at a level appropriate for ${difficulty}.
Use a ${tone} tone.
${extras.join('\n')}`.trim();

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
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
