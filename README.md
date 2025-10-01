Gestio Pro est un outil simple pour gérer une petite boutique ou une activité commerciale. Il permet de suivre les produits en stock, d'enregistrer les ventes, et de noter les dépenses.

Ce projet est conçu pour être facile à déployer, avec un backend en Node.js (Express, SQLite) et un frontend en HTML/CSS/JS pur.

Fonctionnalités

Gestion des produits : Ajouter, modifier et suivre le stock.
Enregistrement des ventes : Décrémente automatiquement le stock et enregistre l'historique des ventes.
Suivi des dépenses : Pour gérer les factures et autres frais.
Bilan : Un aperçu des revenus, des dépenses et de la valeur du stock.
Authentification sécurisée : Connexion et inscription des utilisateurs.
Comment lancer le projet en local

Cloner le dépôt :

git clone [https://github.com/Kb-sama/Gestion-pro.git](https://github.com/Kb-sama/Gestion-pro.git)
cd Gestion-pro/backend
Installer les dépendances :

npm install
Configurer l'environnement : Crée un fichier .env dans le dossier backend/ en copiant le contenu de .env.example. Modifie au moins la valeur de JWT_SECRET.

PORT=3000
JWT_SECRET=ton_secret_long_et_aleatoire
JWT_EXP=12h
BCRYPT_ROUNDS=12
ALLOW_ORIGIN=*
Démarrer le serveur :

node server.js
Le site sera accessible à l'adresse http://localhost:3000 dans ton navigateur.

Déploiement

Ce projet est conçu pour être facilement déployable sur des plateformes comme Render ou Railway. Il suffit de lier le dépôt Git et de configurer les variables d'environnement. Le serveur Node.js gère à la fois le backend et le frontend.

Crédits

Backend : Node.js, Express, SQLite3, JWT, bcrypt
Frontend : HTML, CSS, JavaScript
Concepteur : [kb]
