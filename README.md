# Gun Mayhem para AthenaENV / PS2

Port de **Gun Mayhem** (Flash) para o PS2, escrito em JavaScript sobre o AthenaENV.

## Conteúdo

- **Modos:** Last Man Standing, Last Man Standing (Team), Gun Game, 1 Hit 1 Kill, Duck Survival e a **campanha** de 10 níveis
  (com progressão, desbloqueios de armas e perks, co-op para dois).
- **Mundo:** 12 mapas, 65 armas, dinamites, 7 power-ups, perks, caixas de arma, salto duplo e plataformas atravessáveis.
- **Multiplayer local:** 2 a 4 jogadores (humanos e/ou CPUs; o 3.º e o 4.º controle precisam de multitap), com lobby, personalização
  (10 cores, 15 camisas, 24 chapéus, arma inicial, perk) e câmera compartilhada.
- **Menus:** menu principal, Gun Library (com TEST WEAPON), opções (música, efeitos e botões por jogador) e créditos.
- **Salvamento** no cartão de memória (`mc0:/GM2LOBBY`): lobby, campanha e opções.

## Executar

Coloque o `athena.elf` do AthenaENV nesta pasta (ele não faz parte do repositório) e rode-o com `athena.ini` e `main.js` no mesmo diretório,
no PS2 ou no PCSX2:

```sh
pcsx2 -batch -elf athena.elf   # exemplo: o caminho do ELF e as opções dependem da sua instalação
```

## Controles (padrão, mudam em OPTIONS)

| Ação | DualShock 2 |
| --- | --- |
| Andar | Direcional / analógico esquerdo |
| Pular (duplo) / jetpack | X ou cima |
| Atirar | Quadrado ou R1 |
| Descer de plataforma / abrir o baú (Duck Survival) | Baixo |
| Carregar e lançar dinamite | Segurar e soltar R2 |
| Pausar / confirmar | START |
| Voltar | Círculo |

## Estado

Testado no PCSX2. **Não foi testado em PS2 real, nem com multitap e quatro controles físicos.**
Diferenças conscientes em relação ao original: sem tecla Insert (modo torneio), sem edição do nome dos jogadores e sem a opção QUALITY.

## Créditos

Jogo original: Kevin Gu (programação e design), Arvin Eksiri (arte), música de Kevin MacLeod.
Port para PS2: Gibran Khalil, usando AthenaENV.

Projeto de fã, sem fins comerciais. O jogo, a arte, os sons e a música originais pertencem aos seus autores.
