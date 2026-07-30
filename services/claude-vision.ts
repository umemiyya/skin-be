import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { ScanAnalysisResult } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `Anda adalah sistem analisis kulit wajah berbasis AI untuk aplikasi skincare Indonesia.

Tugas Anda:
1. Periksa apakah gambar yang diberikan benar-benar berisi wajah manusia yang jelas.
2. Jika BUKAN wajah (misalnya foto objek, pemandangan, hewan, teks, atau wajah tidak jelas/tertutup), kembalikan isFace=false.
3. Jika gambar adalah wajah, analisis kondisi kulit wajah tersebut secara visual dan kembalikan hasil analisis.

Jenis kulit yang boleh dipilih HANYA salah satu dari: "Berminyak", "Kering", "Berjerawat. (tidak ada opsi "Normal", "Kombinasi", atau "Sensitif" dalam analisis ini) HANYA ke tiga itu.

Ingredient yang boleh direkomendasikan HANYA dari daftar berikut (gunakan nama persis seperti ini):
Hyaluronic Acid, Ceramides, Glycerin, Shea Butter, Vitamin E, Salicylic Acid, Niacinamide, Tea Tree Oil, Witch Hazel, Zinc, Benzoyl Peroxide, Charcoal, Panthenol, Green Tea

PENTING: Balas HANYA dengan JSON valid tanpa teks tambahan, tanpa markdown code block, dengan format PERSIS seperti berikut:

Jika wajah terdeteksi:
{
  "isFace": true,
  "skinType": "Berminyak",
  "confidence": 98,
  "conditions": {
    "oil": 90,
    "dryness": 15,
    "hydration": 40,
    "pores": 85,
    "acne": 70,
    "redness": 20,
    "texture": 60
  },
  "recommendedIngredients": ["Niacinamide", "Salicylic Acid"]
}

Jika BUKAN wajah:
{
  "isFace": false,
  "skinType": "Normal",
  "confidence": 0,
  "conditions": { "oil": 0, "dryness": 0, "hydration": 0, "pores": 0, "acne": 0, "redness": 0, "texture": 0 },
  "recommendedIngredients": [],
  "message": "Gambar yang diunggah tidak terdeteksi sebagai wajah. Silakan unggah foto wajah yang jelas."
}

Semua nilai pada "conditions" dan "confidence" adalah angka 0-100.`;

function extractJson(text: string): string {
  const cleaned = text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Respons tidak berisi JSON yang valid');
  return cleaned.slice(start, end + 1);
}

export async function analyzeFaceImage(
  base64Image: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<ScanAnalysisResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
          {
            type: 'text',
            text: 'Analisis foto wajah ini dan berikan hasil!',
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((c) => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Tidak ada respons!');
  }

  const jsonString = extractJson(textBlock.text);
  const parsed = JSON.parse(jsonString) as ScanAnalysisResult;

  // Validasi minimal terhadap hasil dari AI
  const allowedTypes = ['Berjerawat', 'Berminyak', 'Kering'];
  if (parsed.isFace && !allowedTypes.includes(parsed.skinType)) {
    parsed.skinType = 'Berminyak';
  }

  return parsed;
}
