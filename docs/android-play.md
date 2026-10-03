# Life OS — Android e Google Play

Application ID (permanente): `com.joaovitorarantes.lifeos` · Nome: **Life OS** · compileSdk/targetSdk 36 · minSdk 23 · versionCode 1 / versionName 1.0.0.

## Por que TWA (Trusted Web Activity)

O Life OS usa renderização no servidor, funções de servidor (`createServerFn`), a rota de IA `/api/agent` e login Google pelo broker do Lovable. Nada disso existe num pacote estático, e o Google bloqueia login OAuth dentro de WebView. Por isso o app Android é um **TWA**: abre `https://lifejvrenii.com/dashboard` em tela cheia pelo Chrome do aparelho. Consequências:

- Atualizações do site chegam ao app sem novo envio à Play (só mudanças no wrapper exigem nova versão).
- Login Google funciona como no navegador (é o próprio Chrome); o retorno do OAuth volta para `https://lifejvrenii.com`, que é o host verificado do TWA.
- **Exige internet.** Não há modo offline.
- Sem Chrome (ou navegador compatível com TWA) o app abre em WebView de fallback, onde o login Google pode falhar.

## O que já está no repositório (`android/`)

- Projeto Gradle com `androidbrowserhelper` (LauncherActivity), ícones gerados de `public/icon-512.png`, splash, cores do tema `#0B0D10`.
- Intent filter de App Links (`autoVerify`) para `https://lifejvrenii.com`.
- `assetlinks.template.json` — modelo com **placeholders** (sem impressões digitais reais).
- `keystore.properties.example` — modelo de assinatura local; `.gitignore` bloqueia keystores, `keystore.properties`, APK/AAB.
- Não há Gradle Wrapper commitado: gere com `gradle wrapper --gradle-version 8.11.1` (ou abra no Android Studio, que oferece criar).

## Passos do dono (na ordem)

1. **Domínio final:** confirmar `lifejvrenii.com` (sem `www`) como host do app. Se mudar, editar `twa.host` em `android/app/build.gradle` e o `site` em `res/values/strings.xml`.
2. **Login:** confirmar que o login Google e os links de e-mail funcionam em `https://lifejvrenii.com` publicado (no Lovable: Cloud → Auth → URLs permitidas incluem o domínio final). Não foi alterado nada nas configurações de autenticação.
3. **Play Console:** criar conta de desenvolvedor (taxa única), verificar identidade, criar o app “Life OS” com o pacote `com.joaovitorarantes.lifeos`.
4. **Chave de upload** (no seu computador, nunca no repositório):
   ```bash
   keytool -genkeypair -v -keystore ~/lifeos-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   cp android/keystore.properties.example android/keystore.properties   # preencher localmente
   ```
5. **Build do AAB:**
   ```bash
   cd android
   gradle wrapper --gradle-version 8.11.1   # primeira vez
   ./gradlew bundleRelease                  # gera app/build/outputs/bundle/release/app-release.aab
   ```
   Requer JDK 17 e Android SDK com a plataforma 36 instalada. Se o AGP/SDK 36 não estiver disponível no seu ambiente, use a última versão estável e ajuste `compileSdk`/`targetSdk` ao mínimo exigido pela Play na data do envio.
6. **Play App Signing:** ao enviar o primeiro AAB, ative o Play App Signing. Copie de *Configuração → Integridade do app* a **SHA-256 da chave de assinatura do app** (e, opcional, a da chave de upload).
7. **Digital Asset Links:** copie `android/assetlinks.template.json` para `public/.well-known/assetlinks.json`, substitua os placeholders pelas SHA-256 reais, publique o site e confira:
   `https://lifejvrenii.com/.well-known/assetlinks.json` (deve responder 200, JSON). Sem isso o app mostra a barra de endereço do Chrome.
8. **Ficha da loja:** descrição pt-BR, ícone 512×512, gráfico 1024×500, capturas de celular, categoria (Finanças/Produtividade), classificação de conteúdo, público-alvo.
9. **Política de privacidade e exclusão de conta:** URLs públicas obrigatórias (ainda não existem no app).
10. **Segurança dos dados:** declarar dados financeiros, e-mail, nome, fotos de perfil, conteúdo enviado à IA; criptografia em trânsito; como solicitar exclusão.
11. **Teste fechado:** contas pessoais novas precisam de 12+ testadores por 14 dias antes de produção.
12. **Cada nova versão do wrapper:** incrementar `versionCode` (obrigatório) e `versionName` em `android/app/build.gradle`.

## Verificação local rápida

- `adb install` do APK de debug (`./gradlew assembleDebug`) → abre o site; sem `assetlinks.json` válido aparece a barra de URL (esperado).
- Ferramenta de teste: `https://developers.google.com/digital-asset-links/tools/generator`.

## Status

Nada foi enviado à Play, nenhuma chave foi criada e nenhuma impressão digital é real. O build Gradle não foi executado neste ambiente.
