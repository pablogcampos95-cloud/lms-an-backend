const crypto = require('crypto');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

const AppError = require('../utils/AppError');

const normalizePrivateKey = (value = '') => value.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

const getRequiredEnv = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new AppError(
      'Firebase Storage no esta configurado. Agrega FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY y FIREBASE_STORAGE_BUCKET.',
      500
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
    storageBucket,
  };
};

const getBucket = () => {
  const env = getRequiredEnv();

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: env.projectId,
        clientEmail: env.clientEmail,
        privateKey: env.privateKey,
      }),
      storageBucket: env.storageBucket,
    });
  }

  return getStorage().bucket(env.storageBucket);
};

const uploadPublicFile = async ({ buffer, contentType, destination }) => {
  const bucket = getBucket();
  const token = crypto.randomUUID();
  const file = bucket.file(destination);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const encodedPath = encodeURIComponent(destination);
  return {
    bucket: bucket.name,
    path: destination,
    url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`,
  };
};

module.exports = {
  uploadPublicFile,
};
