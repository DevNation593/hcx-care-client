import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoRequestForm } from './demo-request-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const create = vi.fn();
vi.mock('@/lib/api/endpoints', () => ({ demoRequestApi: { create: (input: unknown) => create(input) } }));

const contact = { whatsappNumber: '', email: '', responseTime: 'En 24 horas.' };

function fill() {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana Vega' } });
  fireEvent.change(screen.getByLabelText('Consultorio o clínica'), { target: { value: 'Centro Vida' } });
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } });
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '0991234567' } });
  fireEvent.change(screen.getByLabelText('Tamaño del equipo'), { target: { value: '2-5' } });
  fireEvent.click(screen.getByLabelText(/Acepto la/));
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Solicitar demo' }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DemoRequestForm', () => {
  it('shows field errors and sends nothing when the form is empty', async () => {
    render(<DemoRequestForm contact={contact} />);
    submit();

    expect(await screen.findByText('Escribe tu nombre')).toBeInTheDocument();
    expect(screen.getByText('Debes aceptar la política de privacidad')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('sends the request to the API and goes to the thank-you page', async () => {
    create.mockResolvedValue({ received: true });
    render(<DemoRequestForm contact={contact} />);
    fill();
    fireEvent.change(screen.getByLabelText('Mensaje (opcional)'), { target: { value: 'Atendemos nutrición' } });
    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/gracias'));
    expect(create).toHaveBeenCalledWith({
      name: 'Ana Vega',
      clinic: 'Centro Vida',
      email: 'ana@example.com',
      phone: '0991234567',
      teamSize: '2-5',
      message: 'Atendemos nutrición',
      acceptPrivacy: true,
    });
  });

  it('works without any WhatsApp number or contact e-mail configured', () => {
    render(<DemoRequestForm contact={contact} />);
    expect(screen.getByRole('button', { name: 'Solicitar demo' })).toBeInTheDocument();
  });

  it('keeps the typed form and explains the failure when the API rejects it', async () => {
    create.mockRejectedValue({ message: 'Network Error' });
    render(<DemoRequestForm contact={contact} />);
    fill();
    submit();

    expect(await screen.findByText(/No pudimos enviar tu solicitud/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana Vega');
  });

  it('asks to wait when too many requests came from the connection', async () => {
    create.mockRejectedValue({ message: 'Too Many Requests', status: 429 });
    render(<DemoRequestForm contact={contact} />);
    fill();
    submit();

    expect(await screen.findByText(/Intenta de nuevo en unos minutos/)).toBeInTheDocument();
  });

  it('keeps the honeypot out of reach of people', () => {
    render(<DemoRequestForm contact={contact} />);
    const honeypot = screen.getByLabelText('Sitio web', { selector: 'input' });
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows the response-time promise', () => {
    render(<DemoRequestForm contact={contact} />);
    expect(screen.getByText('En 24 horas.')).toBeInTheDocument();
  });
});
