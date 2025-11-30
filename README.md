# LevelRH – Frontend 🏆

[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth-orange?logo=firebase)](https://firebase.google.com/)
[![Cloud Functions](https://img.shields.io/badge/Backend-Cloud%20Functions-yellow)](https://firebase.google.com/docs/functions)
[![GitHub Actions](https://img.shields.io/badge/CI-GitHub%20Actions-black?logo=github-actions)](https://github.com/features/actions)

Interface web do projeto **LevelRH**, uma plataforma gamificada para
**engajamento de colaboradores**, acompanhamento de **metas**, **PDI**, **kudos** e **Mapa de Carreira**.  
Desenvolvida como uma **Single Page Application (SPA)** em React, integrada ao **Firebase
(Auth, Firestore e Cloud Functions)**.

---

## 🎯 Funcionalidades da Interface

- **Autenticação** de colaboradores e gestores usando Firebase Auth.
- **Módulo de Metas**: listagem, atualização de status e pontuação por meta concluída.
- **Mapa de Carreira (Career)**: exibe nível, progresso de XP, streaks, missões do dia e conquistas.
- **Kudos**: envio e recebimento de reconhecimentos entre colegas, com impacto direto no XP.
- **PDI integrado**: plano de desenvolvimento com itens de ação e acompanhamento de progresso.
- **DISC**: questionário comportamental com exibição do perfil dentro do Mapa de Carreira.
- **Ranking e relatórios**: visualização de colaboradores com mais pontos e destaques do período.

---

## 🛠️ Pré-requisitos

- **Node.js** (versão 18 ou superior)
- Conta e projeto configurados no **Firebase** (Auth, Firestore e Cloud Functions)
- Backend de Cloud Functions do Acelerador Empresarial implantado ou rodando em modo emulador

---

## ▶️ Como Rodar (Frontend)

1. **Instale as dependências**:

     ```bash
     npm install
   
2. **Configure as variáveis de ambiente (caso use .env para chaves do Firebase)**:
    Crie um arquivo .env.local na raiz do projeto e preencha com as chaves do Firebase.

   ```bash
      REACT_APP_FIREBASE_API_KEY=...
      REACT_APP_FIREBASE_AUTH_DOMAIN=...
      REACT_APP_FIREBASE_PROJECT_ID=...
      REACT_APP_FIREBASE_STORAGE_BUCKET=...
      REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
      REACT_APP_FIREBASE_APP_ID=...


4. **Inicie o servidor de desenvolvimento**:
      ```bash
    npm start

 5. **Acesse no navegador**:
    ```bash
    http://localhost:3000
    
📚 Documentação Completa
Para detalhes sobre a arquitetura, regras de negócio e o projeto completo, acesse nossa Wiki: 👉 Link para a Wiki do Projeto https://github.com/gustavoKutzke/tcc/wiki
