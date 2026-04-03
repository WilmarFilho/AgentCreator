import { Injectable } from '@nestjs/common';

@Injectable()
export class KnowledgeBaseService {
  private readonly theoryData = [
    {
      source: "Hook Point (Brendan Kane)",
      theory: "A regra dos 3 segundos: O conteúdo precisa quebrar o padrão visual e auditivo imediatamente.",
      scenario: "Criador de conteúdo sobre investimentos postando um vídeo comum.",
      best_practice: "Começar com uma frase de choque: 'Pare de investir em CDB até ver isso' em vez de 'Olá pessoal, hoje vamos falar de CDB'."
    },
    {
      source: "Psicologia de Retenção (Estudos de Algoritmo)",
      theory: "O algoritmo prioriza 'Watch Time' e 'Save Rate'.",
      scenario: "Post carrossel informativo.",
      best_practice: "O último slide deve ser um checklist acionável que obrigue o usuário a salvar para consultar depois."
    },
    {
      source: "Contagioso (Jonah Berger)",
      theory: "Gatilho de Moeda Social: As pessoas compartilham o que as faz parecer inteligentes ou 'por dentro' das novidades.",
      scenario: "Empresa de tecnologia lançando uma ferramenta de automação.",
      best_practice: "Posicionar a ferramenta como um 'acesso exclusivo para quem quer estar no top 1% de produtividade'."
    },
    {
      source: "StoryBrand (Donald Miller)",
      theory: "O cliente é o herói, a marca é o guia. O herói precisa de um plano e um chamado para ação.",
      scenario: "Legenda de venda de um curso online.",
      best_practice: "Estruturar o texto focando na dor do cliente (o vilão) e apresentando o curso como o mapa claro para a vitória."
    },
    {
      source: "As 22 Imutáveis Leis do Marketing (Al Ries)",
      theory: "Lei da Dualidade: A longo prazo, todo mercado se torna uma corrida de dois cavalos.",
      scenario: "Estratégia de posicionamento para uma nova marca de café.",
      best_practice: "Não tente ser o melhor; tente ser a alternativa clara ao líder (ex: 'O café para quem odeia o gosto de queimado da rede famosa')."
    },
    {
      source: "Made to Stick (Chip & Dan Heath)",
      theory: "O Princípio do Inesperado: Para manter a atenção, você deve abrir um 'buraco' de curiosidade no conhecimento do usuário.",
      scenario: "Início de um vídeo no Reels sobre produtividade.",
      best_practice: "Começar com: 'Por que acordar às 5 da manhã está destruindo a sua produtividade' (contraintuitivo)."
    },
    {
      source: "Influência (Robert Cialdini)",
      theory: "Prova Social e Autoridade: Pessoas seguem quem parece ser um especialista ou quem já é seguido por muitos.",
      scenario: "Perfil novo no Instagram tentando ganhar confiança.",
      best_practice: "Mostrar bastidores de estudos, certificados ou depoimentos de clientes logo nos destaques principais."
    },
    {
      source: "Jab, Jab, Jab, Right Hook (Gary Vaynerchuk)",
      theory: "O conteúdo deve ser nativo e agregar valor antes de pedir qualquer coisa em troca.",
      scenario: "Estratégia de conteúdo para uma semana de lançamento.",
      best_practice: "Postar 3 vídeos resolvendo problemas reais do público sem vender nada, para só no 4º vídeo fazer a oferta."
    },
    {
      source: "Hooked (Nir Eyal)",
      theory: "Recompensa Variável: O usuário volta quando não sabe exatamente o que vai encontrar, mas sabe que será prazeroso.",
      scenario: "Criação de uma série de stories diários.",
      best_practice: "Mudar o formato da série todos os dias (um dia caixa de perguntas, outro dia tutorial rápido, outro dia meme interno)."
    },
    {
      source: "Traffic Secrets (Russell Brunson)",
      theory: "O Framework Gancho-História-Oferta (Hook-Story-Offer).",
      scenario: "Script para um vídeo de vendas no Reels.",
      best_practice: "0-3s: Gancho visual forte; 3-15s: Uma história curta de superação; 15-30s: Chamada clara para o link na bio."
    },
    {
      source: "O Ponto da Virada (Malcolm Gladwell)",
      theory: "O Fator de Fixação: Pequenas mudanças na apresentação tornam a mensagem irresistível.",
      scenario: "Design de um post estático informativo.",
      best_practice: "Utilizar cores contrastantes e fontes em negrito apenas nas palavras que evocam emoção ou urgência."
    },
    {
      source: "Estratégia do Oceano Azul (W. Chan Kim)",
      theory: "Não concorra no preço ou em funcionalidades comuns; crie um novo espaço de mercado.",
      scenario: "Personal Trainer tentando se destacar no Instagram.",
      best_practice: "Parar de postar 'treino de perna' e focar em 'treino de mobilidade para gamers que sentem dor nas costas'."
    },
    {
      source: "Psicologia das Cores (Estudos de Marketing Visual)",
      theory: "Cores influenciam o humor e a taxa de clique (CTR).",
      scenario: "Escolha da cor de fundo para um anúncio de urgência.",
      best_practice: "Usar amarelo ou laranja para atenção imediata, ou vermelho para escassez, evitando tons pastéis que relaxam o olhar."
    },
    {
      source: "Show Your Work! (Austin Kleon)",
      theory: "Documentar o processo é mais valioso do que apenas postar o produto final.",
      scenario: "Desenvolvedor de software criando um SaaS.",
      best_practice: "Postar um Reels mostrando os erros (bugs) e as frustrações do dia a dia, gerando conexão humana e autenticidade."
    },
    {
      source: "The Lean Startup (Eric Ries)",
      theory: "Feedback Loop: Construir-Medir-Aprender rápido.",
      scenario: "Análise de métricas de um post que flopou.",
      best_practice: "Identificar em que segundo a retenção caiu e regravar apenas o gancho inicial para postar novamente após 15 dias."
    }
  ];

  /**
   * Gera a string no formato JSONL pronta para fine-tuning.
   * Cada linha é um objeto JSON independente.
   */
  generateKnowledgeJsonl(): string {
    const SYSTEM_PROMPT = "Você é um Estrategista Senior de Growth para Instagram. Sua base de conhecimento é fundamentada nos maiores best-sellers de marketing e retenção do mundo.";

    return this.theoryData.map(item => {
      const messageObj = {
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: `Aplique a teoria de [${item.source}] para o seguinte cenário: ${item.scenario}`
          },
          {
            role: 'assistant',
            content: `De acordo com [${item.source}], a estratégia ideal é: ${item.best_practice}. O foco principal deve ser ${item.theory}`
          }
        ]
      };
      return JSON.stringify(messageObj);
    }).join('\n');
  }
}