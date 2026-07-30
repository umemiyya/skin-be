// app/api/scan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { analyzeFaceImage } from '@/services/claude-vision';
import { matchProducts } from '@/lib/matching';
import type { ScanAnalysisResult, RecommendedProduct } from '@/types';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Ganti dengan domain frontend lo, atau '*' kalau memang mau dibuka publik
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

interface ScanApiResponse {
  success: boolean;
  error?: string;
  result?: ScanAnalysisResult;
  recommendations?: RecommendedProduct[];
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders();

  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json<ScanApiResponse>(
        { success: false, error: 'Tidak ada gambar yang diunggah.' },
        { status: 400, headers }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json<ScanApiResponse>(
        { success: false, error: 'Format file tidak didukung. Gunakan JPG, PNG, atau WEBP.' },
        { status: 400, headers }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json<ScanApiResponse>(
        { success: false, error: 'Ukuran gambar maksimal 5MB.' },
        { status: 400, headers }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';

    const result = await analyzeFaceImage(base64, mediaType);

    if (!result.isFace) {
      return NextResponse.json<ScanApiResponse>(
        {
          success: false,
          error: result.message || 'Gambar yang diunggah bukan foto wajah. Silakan coba lagi.',
        },
        { status: 422, headers }
      );
    }

    const recommendations = matchProducts(result);

    return NextResponse.json<ScanApiResponse>(
      { success: true, result, recommendations },
      { status: 200, headers }
    );
  } catch (err) {
    console.error('POST /api/scan error:', err);
    return NextResponse.json<ScanApiResponse>(
      { success: false, error: 'Terjadi kesalahan saat menganalisis gambar. Silakan coba lagi.' },
      { status: 500, headers }
    );
  }
}