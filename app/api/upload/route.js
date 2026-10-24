import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ success: false, error: 'Tidak ada berkas yang diunggah' }, { status: 400 });
    }

    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;

    // Validate size (max 50 MB)
    if (fileSize > 50 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Ukuran berkas melebihi batas maksimal 50 MB' }, { status: 400 });
    }

    let fileUrl = `/uploads/${fileName}`;

    // If Supabase is configured, upload to 'documents' bucket
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const fileExt = fileName.split('.').pop();
        const storagePath = `public/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: false
          });

        if (!uploadErr && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('documents')
            .getPublicUrl(storagePath);
          if (publicUrlData?.publicUrl) {
            fileUrl = publicUrlData.publicUrl;
          }
        }
      } catch (storageErr) {
        console.warn('Storage upload warning, fallback to path:', storageErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        fileName,
        fileSize,
        fileUrl,
        formattedSize: (fileSize / (1024 * 1024)).toFixed(1) + ' MB'
      }
    });
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
