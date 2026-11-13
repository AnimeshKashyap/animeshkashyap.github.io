import { mountLauncher } from './launcher';

export type ChatbotPage = 'main' | 'v4';

const CHATBOT_HOST_ID = 'portfolio-chatbot-host';

export function mountChatbot({ page }: { page: ChatbotPage }): void {
  if (document.getElementById(CHATBOT_HOST_ID) !== null) {
    return;
  }

  const host = document.createElement('div');
  host.id = CHATBOT_HOST_ID;
  host.setAttribute('data-chatbot-page', page);
  document.body.appendChild(host);

  mountLauncher(host, page);
}
