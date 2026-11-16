# Pelote

> Garde le fil. Démêle ta journée.

Une app (web installable, desktop + mobile) pour cerveaux TDAH : une seule intention visible (**le Fil**), un rituel avant de changer de sujet (**le Nœud**), un endroit pour garer les rabbit holes (**le Panier**), une boîte à pensées qui repère « appeler », « écrire à », les dates… et te les rappelle le soir. Humeur et énergie se notent en deux taps, et Pilou le chat veille.

## Stack

| Partie | Techno |
|---|---|
| Front | React 18 + Vite, PWA (installable, partage Android) |
| API | Cloudflare Pages Functions (`functions/api/[[path]].ts`) |
| Données | Cloudflare D1 (SQLite) — `migrations/` |
| Images du Panier | Cloudflare R2 |
| Connexion | Cloudflare Access (Google ou code par email), JWT vérifié côté API |

## Lancer en local

Prérequis : Node 20+.

```bash
npm install
npm run db:local          # crée la base D1 locale
npm test                  # tests du parser français
```

Puis, dans deux terminaux :

```bash
npm run build && npx wrangler pages dev dist --port 8788   # API + base locale
```

```bash
npm run dev               # front avec rechargement à chaud, sur http://localhost:5173
```

En local, l'utilisateur est simulé par `DEV_USER` (fichier `.dev.vars`, jamais déployé).

## Mettre en ligne (GitHub + Cloudflare)

1. **GitHub** : crée un repo privé et pousse ce dossier.
2. **Cloudflare** (une fois) :
   ```bash
   npx wrangler login
   npx wrangler d1 create pelote             # copie l'id dans wrangler.toml (database_id)
   npx wrangler r2 bucket create pelote-panier
   npm run db:remote                         # crée les tables en production
   ```
3. **Pages** : Workers & Pages → Create → Pages → *Connect to Git* → ton repo.
   - Build command : `npm run build`
   - Output : `dist`
   - Les liaisons D1 (`DB`) et R2 (`BUCKET`) sont lues depuis `wrangler.toml`.
4. **Access (la connexion)** : Zero Trust → Access → Applications → *Self-hosted*.
   - Domaine : `pelote.pages.dev` (ajoute aussi `*.pelote.pages.dev` pour les previews).
   - Policy : *Allow* → *Emails* → ton adresse.
   - Copie l'**Application Audience (AUD) Tag** et le domaine de ton équipe (`xxx.cloudflareaccess.com`).
5. Renseigne `ACCESS_TEAM_DOMAIN` et `ACCESS_AUD` dans `wrangler.toml` (ou dans Pages → Settings → Variables), puis redéploie.

⚠️ Sans l'étape 4–5, l'API refuse toutes les requêtes en production (401) : c'est voulu, rien n'est jamais ouvert par défaut.

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
- **Bilan du soir** : la notification part tant que Pelote est ouvert (onglet ou app installée). Des notifications push serveur (Cron Worker + Web Push) sont la prochaine étape.
- **Confluence** : synchro en lecture seule prévue, pas encore branchée.
