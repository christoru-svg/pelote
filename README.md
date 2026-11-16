# Pelote

> Garde le fil. Démêle ta journée.

Une app (web installable, desktop + mobile) pour cerveaux TDAH : une seule intention visible (**le Fil**), un rituel avant de changer de sujet (**le Nœud**), un endroit pour garer les rabbit holes (**le Panier**), une boîte à pensées qui repère « appeler », « écrire à », les dates… et te les rappelle le soir. Humeur et énergie se notent en deux taps, et Pilou le chat veille.

## Stack

| Partie | Techno |
|---|---|
| Front | React 18 + Vite, PWA (installable, partage Android) |
| Connexion | Firebase Auth (Google), limitée aux adresses listées dans les règles |
| Données | Cloud Firestore, avec cache hors ligne : tout est rangé sous `users/{uid}/…` |
| Images du Panier | Firebase Storage (`users/{uid}/panier/…`) |
| Hébergement | Firebase Hosting |

La sécurité vient des règles `firestore.rules` et `storage.rules` : chaque personne ne voit que ses données, et seules les adresses de la liste peuvent se connecter.

## Lancer en local

Prérequis : Node 20+, et la config de ton projet Firebase dans `src/firebase-config.ts`.

```bash
npm install
npm test        # tests du parser français
npm run dev     # http://localhost:5173 (données réelles de ton projet Firebase)
```

## Mettre en ligne

1. **Console Firebase** → *Ajouter un projet* (Analytics inutile).
2. **Authentication** → *Commencer* → active **Google**.
3. **Firestore Database** → *Créer* → mode **production**, région `eur3` (Europe).
4. **Storage** → *Commencer* : demande le forfait **Blaze** (carte bancaire, gratuit sous 5 Go).
5. **Paramètres du projet** → *Vos applications* → **Web** → copie la config dans `src/firebase-config.ts`.
6. Dans `firestore.rules` et `storage.rules`, vérifie la liste des adresses autorisées.
7. Déploie :
   ```bash
   npx firebase login
   npx firebase use --add        # choisis ton projet
   npm run deploy                # build + hosting + règles
   ```
8. **Authentication → Paramètres → Domaines autorisés** : `<projet>.web.app` y est déjà ; ajoute ton domaine perso si tu en utilises un.

## Raccourcis

| | |
|---|---|
| `⌘⇧9` | Capturer dans le Panier (lien, texte, image, capture d'écran) |
| `⌘⇧8` | Déposer une pensée |
| `N` | Ajouter un sujet (« Kick-off lundi 10h #équipe 1h ») |
| `⌘V` hors d'un champ | Un lien ou une image collés vont dans le Panier |

## Limites connues (et la suite)

- **Raccourci global** : dans le navigateur, `⌘⇧9` ne marche que quand Pelote est au premier plan. Le raccourci système demandera l'app Mac (Tauri, même code React).
- **Partage depuis le téléphone** : le menu « Partager → Pelote » marche sur Android une fois l'app installée. Sur iPhone, Apple ne le permet pas aux web apps : un Raccourci iOS qui ouvre `https://<ton-domaine>/partage?text=…` fait la même chose.
- **Bilan du soir** : la notification part tant que Pelote est ouvert (onglet ou app installée). Des notifications push serveur (Cloud Functions + Firebase Cloud Messaging) sont la prochaine étape.
- **Confluence** : synchro en lecture seule prévue, pas encore branchée.
