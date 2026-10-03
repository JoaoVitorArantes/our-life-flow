# Life OS — Android e Google Play

Application ID (permanente): `com.joaovitorarantes.lifeos` · Nome: **Life OS** · compileSdk/targetSdk 36 · minSdk 23 · versionCode 1 / versionName 1.0.0.

## Por que TWA (Trusted Web Activity)

O Life OS usa renderização no servidor, funções de servidor (`createServerFn`), a rota de IA `/api/agent` e login Google pelo broker do Lovable. Nada disso existe num pacote estático, e o Google bloqueia login OAuth dentro de WebView. Por isso o app Android é um **TWA**: abre `https://our-life-flow.lovable.app/dashboard` em tela cheia pelo Chrome do aparelho.

> **Host provisório:** `our-life-flow.lovable.app` é o domínio atual hospedado pelo Lovable. Só troque se o dono confirmar um domínio próprio — nesse caso altere `twa.host` em `android/app/build.gradle`, o `site` em `android/app/src/main/res/values/strings.xml` e publique o `assetlinks.json` no novo domínio.

Consequências:

- Atualizações do site chegam ao app sem novo envio à Play (só mudanças no wrapper exigem nova versão).
- Login Google funciona como no navegador (é o próprio Chrome), **desde que** `https://our-life-flow.lovable.app` esteja permitido nas configurações externas de login. Isso **não foi verificado nem alterado** — conferir antes da Play.
- **Exige internet.** Não há modo offline.
- Sem Chrome (ou navegador compatível com TWA) o app abre em WebView de fallback, onde o login Google pode falhar.

## O que já está no repositório (`android/`)

- Projeto Gradle com `androidbrowserhelper` (LauncherActivity), ícones gerados de `public/icon-512.png`, splash, cores do tema `#0B0D10`.
- Intent filter de App Links (`autoVerify`) para `https://our-life-flow.lovable.app` (só verifica após o `assetlinks.json` real).
- `assetlinks.template.json` — modelo com **placeholders** (sem impressões digitais reais).
- `keystore.properties.example` — modelo de assinatura local; `.gitignore` bloqueia keystores, `keystore.properties`, APK/AAB.
- AGP 8.11.1 (suporta compileSdk 36). Não há Gradle Wrapper commitado: gere com `gradle wrapper --gradle-version 8.13` (mínimo exigido pelo AGP 8.11) ou abra a pasta `android/` no Android Studio (Narwhal ou mais novo), que oferece criar.
- Não há `local.properties`: o Android Studio cria apontando para o SDK; pela linha de comando, defina `ANDROID_HOME` ou crie `sdk.dir=...`.

## Passos do dono (na ordem)

1. **Domínio:** o host provisório é `our-life-flow.lovable.app`. Se um domínio próprio for confirmado, atualizar os dois arquivos citados acima antes do primeiro envio (App Links ficam presos ao host).
2. **Login (pendente, não verificado):** testar login Google e links de e-mail em `https://our-life-flow.lovable.app` publicado e conferir que esse host está nas URLs permitidas da autenticação. Nenhuma configuração de autenticação foi alterada.
3. **Play Console:** criar conta de desenvolvedor (taxa única), verificar identidade, criar o app “Life OS” com o pacote `com.joaovitorarantes.lifeos`.
4. **Chave de upload** (no seu computador, nunca no repositório):
   ```bash
   keytool -genkeypair -v -keystore ~/lifeos-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   cp android/keystore.properties.example android/keystore.properties   # preencher localmente
   ```
5. **Build do AAB:**
   ```bash
   cd android
   gradle wrapper --gradle-version 8.13      # primeira vez
   ./gradlew bundleRelease                  # gera app/build/outputs/bundle/release/app-release.aab
   ```
   Requer JDK 17 e Android SDK com a plataforma 36 instalada. Se o AGP/SDK 36 não estiver disponível no seu ambiente, use a última versão estável e ajuste `compileSdk`/`targetSdk` ao mínimo exigido pela Play na data do envio.
6. **Play App Signing:** ao enviar o primeiro AAB, ative o Play App Signing. Copie de *Configuração → Integridade do app* a **SHA-256 da chave de assinatura do app** (e, opcional, a da chave de upload).
7. **Digital Asset Links:** copie `android/assetlinks.template.json` para `public/.well-known/assetlinks.json`, substitua os placeholders pelas SHA-256 reais, publique o site e confira:
   `https://our-life-flow.lovable.app/.well-known/assetlinks.json` (deve responder 200, JSON). Sem isso o app mostra a barra de endereço do Chrome.
8. **Ficha da loja:** descrição pt-BR, ícone 512×512, gráfico 1024×500, capturas de celular, categoria (Finanças/Produtividade), classificação de conteúdo, público-alvo.
9. **Política de privacidade e exclusão de conta:** URLs públicas obrigatórias (ainda não existem no app).
10. **Segurança dos dados:** declarar dados financeiros, e-mail, nome, fotos de perfil, conteúdo enviado à IA; criptografia em trânsito; como solicitar exclusão.
11. **Teste fechado:** contas pessoais novas precisam de 12+ testadores por 14 dias antes de produção.
12. **Cada nova versão do wrapper:** incrementar `versionCode` (obrigatório) e `versionName` em `android/app/build.gradle`.

## Verificação local rápida

- `adb install` do APK de debug (`./gradlew assembleDebug`) → abre o site; sem `assetlinks.json` válido aparece a barra de URL (esperado).
- Ferramenta de teste: `https://developers.google.com/digital-asset-links/tools/generator`.

## Status

Nada foi enviado à Play, nenhuma chave foi criada e nenhuma impressão digital é real. O build/configuração Gradle **não foi executado** (o ambiente de desenvolvimento não tem JDK nem Android SDK); a estrutura foi revisada manualmente: plugins/repositórios, `LauncherActivity` do `androidbrowserhelper`, placeholders do manifesto, ícones, splash, cores e `filepaths.xml`.
