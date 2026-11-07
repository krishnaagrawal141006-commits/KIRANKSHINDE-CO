module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // These are browser-safe public settings only. Never add service-role keys here.
  return res.status(200).json({
    url: process.env.SUPABASE_URL || '',
    publishableKey: process.env.SUPABASE_ANON_KEY || '',
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || ''
  });
};
