import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/http.ts';
import { supabaseAdmin } from '../_shared/supabaseClient.ts';
import { log } from '../_shared/logger.ts';

interface MapGenerationPayload {
  incident_id: string;
  latitude: number;
  longitude: number;
  reference_id: string;
}

async function generateStaticMap(lat: number, lon: number, referenceId: string): Promise<Uint8Array> {
  const username = Deno.env.get('MAPBOX_USERNAME');
  const styleId = Deno.env.get('MAPBOX_STYLE_ID');
  const token = Deno.env.get('MAPBOX_TOKEN');

  if (!username || !styleId || !token) {
    throw new Error('Missing required Mapbox environment variables');
  }

  // Generate static map URL
  const width = 600;
  const height = 400;
  const zoom = 8;
  
  const mapboxUrl = `https://api.mapbox.com/styles/v1/${username}/${styleId}/static/` +
    `pin-s+ff0000(${lon},${lat})/` + // Red pin at incident location
    `${lon},${lat},${zoom}/` +
    `${width}x${height}` +
    `?access_token=${token}`;

  // Fetch map image
  const response = await fetch(mapboxUrl);
  if (!response.ok) {
    throw new Error(`Failed to generate map: ${response.statusText}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function uploadToCloudinary(imageData: Uint8Array, referenceId: string): Promise<string> {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Missing required Cloudinary environment variables');
  }

  // Create form data with image
  const formData = new FormData();
  const blob = new Blob([imageData], { type: 'image/png' });
  formData.append('file', blob, `${referenceId}.png`);
  formData.append('public_id', `incident-maps/${referenceId}`);
  formData.append('api_key', apiKey);

  // Generate timestamp and signature
  const timestamp = Math.floor(Date.now() / 1000);
  formData.append('timestamp', timestamp.toString());

  const encoder = new TextEncoder();
  const data = encoder.encode(`public_id=incident-maps/${referenceId}&timestamp=${timestamp}${apiSecret}`);
  const signature = await crypto.subtle.digest('SHA-1', data);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  formData.append('signature', signatureHex);

  // Upload to Cloudinary
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to upload to Cloudinary: ${response.statusText}`);
  }

  const result = await response.json();
  return result.secure_url;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: MapGenerationPayload = await req.json();
    const { incident_id, latitude, longitude, reference_id } = payload;

    log.info(`Generating map for incident ${reference_id}`);

    // Generate static map
    const mapImage = await generateStaticMap(latitude, longitude, reference_id);
    
    // Upload to Cloudinary
    const imageUrl = await uploadToCloudinary(mapImage, reference_id);

    // Update incident record
    const { error } = await supabaseAdmin
      .from('incident')
      .update({ map_image_url: imageUrl })
      .eq('id', incident_id);

    if (error) {
      throw error;
    }

    log.info(`Successfully generated and stored map for incident ${reference_id}`);

    return new Response(
      JSON.stringify({ success: true, map_image_url: imageUrl }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    log.error(`Error in generate-map function: ${errorMessage}`);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
