// Configuration web du projet Firebase « pelote-todo ».
// Ces valeurs ne sont pas secrètes : elles sont faites pour être visibles dans la page.
// La sécurité vient des règles (firestore.rules et storage.rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyBC1bY-0fsyEHFgpQ4A1xHqTqPfcHGGt2k',
  authDomain: 'pelote-todo.firebaseapp.com',
  projectId: 'pelote-todo',
  storageBucket: 'pelote-todo.firebasestorage.app',
  messagingSenderId: '1057737482233',
  appId: '1:1057737482233:web:a8ceb9715ac796b9c92728',
};

export const isConfigured = !firebaseConfig.projectId.startsWith('A-REMPLIR');
