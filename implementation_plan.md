# Implementação: Análise Final com LLM Otimizada (Fine-Tuning)

Este plano detalha como implementaremos o bloco final do fluxo: **"ANALISE FINAL NUMA LLM COM FINE TUNE"**, responsável por pegar os dados brutos processados (OCR, CLIP, NLP) e gerar o Raio-X do criador (Nichos, Pontos Fortes/Fracos, Psicologia, Público e Posicionamento).

## Visão Geral do Problema
O objetivo é transformar um grande volume de dados desestruturados (15 posts com textos de imagem, legendas e descrições visuais) em uma estrutura JSON altamente precisa e analítica que irá popular a nossa tabela `brand_personas` no Supabase.

Não podemos simplesmente "ligar um fine-tune" do dia para a noite, pois um modelo fine-tuned precisa de um **dataset de exemplos** (Inputs -> Outputs desejados) para aprender o padrão de análise.

---

## Estratégia em 4 Fases

### Fase 1: Arquitetura Inicial (Prompt Engineering + RAG/GPT-4o)
Antes de construir o modelo otimizado, precisamos gerar os dados de treino de alta qualidade.
1. **Modelagem de Prompt:** Criaremos um System Prompt complexo instruindo a LLM a atuar como um "Especialista em Marketing e Análise de Perfil do Instagram".
2. **Structured Outputs (JSON Mode):** Utilizaremos a API da OpenAI exigindo que a resposta venha estritamente no formato JSON, tipado com as chaves exatas que o seu diagrama propõe:
   * `nicho_principal`
   * `subnichos` (array)
   * `pontos_fortes` (array)
   * `pontos_fracos` (array)
   * `fator_viralizacao` (numérico ou string descritiva)
   * `resumo_psicologico`
   * `publico_alvo`
   * `posicionamento`
3. **Pipeline de Coleta (Oficial + Apify):** Sempre que processarmos o perfil de um usuário ou analisarmos um *Top Creator*, faremos a coleta de dados utilizando a **API Oficial do Instagram** em conjunto com web scraping utilizando ferramentas como o **APIFY** (para potencializar a captura de dados de engajamento ou dados inacessíveis via API oficial). Salvaremos no banco:
   * **O Substrato (Input):** O texto bruto juntando OCR, metadados do CLIP e Análise Semântica, junto das métricas extraídas (Views, Seguidores).
   * **O Resultado (Output):** O JSON analítico perfeito gerado pelo GPT-4o e validado pelo sistema.

### Fase 2: Construção do Dataset de Fine-Tuning
Após termos um volume razoável (aprox. **100 a 500 exemplos**) de perfis validados na base:
1. Desenvolveremos um job no backend que exporta esses logs no formato `JSONL` exigido pela OpenAI.
2. O formato de cada linha será a representação de uma conversa:
```json
{"messages": [{"role": "system", "content": "Você é um analista de marketing focado em traçar raios-x psicológicos..."}, {"role": "user", "content": "{ \"dados_brutos_15_posts\": \"...\" }"}, {"role": "assistant", "content": "{ \"nicho_principal\": \"...\" }"}]}
```

### Fase 3: Treinamento (Fine-Tuning Inteligente)
A melhor escolha atual para Fine-Tuning estruturado é o `gpt-4o-mini`. Ele é veloz, extremamente barato, e, quando fine-tunado adequadamente para tarefas específicas, alcança o nível cognitivo das versões maiores (GPT-4o/Claude 3.5 Sonnet) *apenas* na sua tarefa específica.
1. Enviaremos o arquivo `.jsonl` via API de Fine-Tuning da OpenAI.
2. Treinaremos o modelo para "aprender" o estilo da análise, a profundidade das críticas aos pontos fracos e o padrão de formatação JSON esperado.
3. Obtenção do ID do modelo personalizado (ex: `ft:gpt-4o-mini-2024-07-18:agentcreator:perfil-analise:v1`).

### Fase 4: Integração Neural no Back-end
Substituir a chamada de inteligência no fluxo da arquitetura:
1. Atualizar o serviço de processamento (ex: `IntelligenceService` no Node/NestJS):
   * Trocar o modelo genérico pelo seu modelo customizado `ft:gpt-4o-mini-...`.
2. **Resultados Esperados:**
   * **Queda drástica nos custos** de análise por perfil/creator.
   * **Velocidade muito maior** de processamento do pipeline diário, diminuindo os gargalos nas filas de RabbitMQ/BullMQ do servidor.
   * Respostas extremamente padronizadas, acabando com "alucinações" estruturais.

---

## Especificação: Cálculo do Fator de Viralização

Para o **"Fator de Viralização"**, o sistema realizará um cálculo matemático algorítmico exato antes de enviá-lo ao processamento da LLM, assegurando confiabilidade nos números analíticos.
* **Fórmula:** `Quantidade de Views do Post / Número de Seguidores do Creator`
* **Exemplo de Baixa Viralização:** Creator com 1.000 seguidores cujo post obteve 1.000 views (`Score = 1`).
* **Exemplo de Alta Viralização:** Creator com 1.000 seguidores cujo post obteve 100.000 views (`Score = 100`).

Esse *Score* será uma das propriedades enviadas para a LLM, permitindo que a IA foque apenas no trabalho de psicologia e contextualização sem causar alucinações matemáticas.

## Fase 1.5: "Cold Start" Global via Benchmark (Sem Inputs Manuais)
Para construirmos o dataset de forma super escalável, não exigiremos que você passe `@` por `@`.
1. **Endpoint de Scan Global (`/benchmark/global`)**: Esta rota fará a mágica.
2. **Descoberta Automática**: 
   - A rota dispara buscas automatizadas via Apify por *keywords* virais ou hashtags genéricas representativas (ex: `#marketing`, `#lifestyle`, `#comedy`) focando em top países (ex: BR, US, IN, DE, FR) limitando a captura a perfis que tenham mais de `1M` de seguidores ou com alta densidade de engajamento. (Alternativamente: Utilizar uma *Seed List* configurável de ~100 Top Creators mundiais no banco).
3. **Pipeline Analítico Focado**: 
   - Recebido a lista automatizada de @s, o backend orquestra via processamento assíncrono (em *batches*) a captura de 30 posts para *cada* criador usando o **Apify**.
   - Os dados passam pelo OCR/Visão (GPT-4o) + Transcrição (Whisper-1), extraindo o conteúdo e persistindo o super output de inteligência na base de dados (`brand_personas`).
4. Ao finalizar todo o lote massivo, a aplicação estará com centenas de "Raio-X de Ouro" persistidos, finalizando a fase de "Data Collection".

## Fase 2: Geração do Dataset (Finalizada)
O módulo `/fine-tune/export-jsonl` (já implementado) compila todos esses Raio-X massivos extraídos na Fase 1.5 e transcreve para a sintaxe `JSONL` padrão exigida pela OpenAI.

## Fase 3 e 4: O Treinamento e "Injeção" da IA Personalizada no Sistema
O processo para transformar o "Dataset" na nossa LLM de ponta e conectá-la ao app funcionará assim:

1. **Ação do Usuário (OpenAI)**: 
   - Você efetuará o download do arquivo `jsonl` a partir da nossa rota.
   - Entrará no [OpenAI Fine-Tuning Dashboard](https://platform.openai.com/finetune).
   - Inserirá o arquivo, definirá o modelo base para `gpt-4o-mini` (para termos o menor custo de inferência possível com altíssima velocidade) e inciará o "Job".
   - Após alguns minutos/horas, a OpenAI fornecerá uma string final. Ex: `ft:gpt-4o-mini:my-org:custom-raiox:abCdE123`.

2. **Injeção Dinâmica na Aplicação (Backend)**:
   - Modificaremos o backend para ler uma variável de ambiente chamada `FINE_TUNED_MODEL_ID`.
   - Você colocará o ID gerado (ex: `ft:gpt-4o-mini...`) no painel da sua hospedagem ou `.env`.
   - No `openai.service.ts`, o algoritmo do `analyzePersonaDeep` alterará inteligentemente seu comportamento: ao invés de usar as regras pesadas de prompt no `gpt-4o` padrão, ele enviará os textos puros para o `process.env.FINE_TUNED_MODEL_ID`. A resposta JSON voltará milissegundos depois, padronizada de acordo com as centenas de referências virais mundiais absorvidas.

## Próximos Passos (Validação do Plano)

Ao receber o seu "De Acordo", vou começar a **programar**:
- A Rota e o Job de Automação de `Global Benchmark` (Puxando perfis de países sem login nativo).
- O código de "fallback" inteligente no backend para usar a `FINE_TUNED_MODEL_ID` assim que ela for conectada.


