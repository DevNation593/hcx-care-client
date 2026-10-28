import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { site } from '@/content/site';
import { resetConsent, writeConsent } from '../consent/consent';
import { CaseStudies } from './case-studies';
import { FaqSection } from './faq';
import { Hero } from './hero';
import { LocationSection } from './location';
import { PlanLadder } from './plan-ladder';
import { formatMoney, formatPlanPrice } from './plans';
import { Reviews } from './reviews';
import { Team } from './team';

beforeEach(() => act(() => resetConsent()));

describe('Hero', () => {
  it('shows the brand, the headline and the demo and WhatsApp calls to action', () => {
    render(<Hero brand="HCX Care" hero={site.hero} contact={{ whatsappNumber: '593991234567', email: '', responseTime: 'En 24 horas.' }} />);
    expect(screen.getByText('HCX Care')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: site.hero.title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Solicitar demo' })).toHaveAttribute('href', '/contacto');
    expect(screen.getByRole('link', { name: 'Escribir por WhatsApp' }).getAttribute('href')).toContain('wa.me/593991234567');
    expect(screen.getByText('En 24 horas.')).toBeInTheDocument();
  });

  it('omits WhatsApp without a number', () => {
    render(<Hero brand="HCX Care" hero={site.hero} contact={{ whatsappNumber: '', email: '', responseTime: '' }} />);
    expect(screen.queryByRole('link', { name: 'Escribir por WhatsApp' })).not.toBeInTheDocument();
  });
});

describe('PlanLadder', () => {
  it('formats prices with cents only when there are any', () => {
    expect(formatPlanPrice(site.plans[0])).toBe('$24,90');
    expect(formatPlanPrice(site.plans[4])).toBe('A medida');
    expect(formatMoney(14)).toBe('$14');
  });

  it('lists the four priced plans in order, then the custom one', () => {
    render(<PlanLadder plans={site.plans} />);
    expect(screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Esencial', 'Profesional', 'Centro', 'Clínica', 'Personalizado',
    ]);
    expect(screen.getByText(/más IVA/)).toBeInTheDocument();
    const custom = screen.getByRole('article', { name: 'Personalizado' });
    expect(custom).toHaveTextContent('A medida');
    expect(within(custom).getByRole('link', { name: 'Hablar con ventas' })).toHaveAttribute('href', '/contacto');
  });

  it('shows professionals, branches and invoices of each plan', () => {
    render(<PlanLadder plans={site.plans} />);
    const esencial = screen.getByRole('article', { name: 'Esencial' });
    expect(within(esencial).getByText('$24,90')).toBeInTheDocument();
    expect(within(esencial).getByText('al mes + IVA')).toBeInTheDocument();
    expect(within(esencial).getByText('1 profesional')).toBeInTheDocument();
    expect(within(esencial).getByText('1 sede')).toBeInTheDocument();
    expect(within(esencial).getByText('30 comprobantes electrónicos al mes')).toBeInTheDocument();
    expect(within(esencial).queryByText(/por profesional adicional/)).not.toBeInTheDocument();

    const clinica = screen.getByRole('article', { name: 'Clínica' });
    expect(within(clinica).getByText('$149,90')).toBeInTheDocument();
    expect(within(clinica).getByText('15 profesionales')).toBeInTheDocument();
    expect(within(clinica).getByText('5 sedes')).toBeInTheDocument();
    expect(within(clinica).getByText('1.000 comprobantes electrónicos al mes')).toBeInTheDocument();
    expect(within(clinica).getByText('Hasta 1.500 pacientes activos')).toBeInTheDocument();
    expect(within(clinica).getByText('$10 por profesional adicional')).toBeInTheDocument();
  });

  it('marks the most chosen plan once', () => {
    render(<PlanLadder plans={site.plans} />);
    const marked = screen.getAllByRole('article')
      .filter((card) => within(card).queryByText('Más elegido'))
      .map((card) => card.getAttribute('aria-label'));
    expect(marked).toEqual(['Profesional']);
  });

  it('labels each instance separately when rendered twice', () => {
    render(
      <>
        <PlanLadder plans={site.plans} heading="Planes" />
        <PlanLadder plans={site.plans} heading="Otra vez" />
      </>,
    );
    expect(screen.getByRole('region', { name: 'Planes' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Otra vez' })).toBeInTheDocument();
  });
});

describe('FaqSection', () => {
  it('renders each question with its answer', () => {
    render(<FaqSection faq={site.faq} />);
    expect(screen.getAllByRole('group')).toHaveLength(5);
    expect(screen.getByText(site.faq[0].answer)).toBeInTheDocument();
  });
});

describe('sections that need real content', () => {
  it('render nothing while empty', () => {
    const { container } = render(
      <><Reviews reviews={[]} /><CaseStudies items={[]} /><Team members={[]} /><LocationSection location={null} /></>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('render reviews, cases and team once content exists', () => {
    render(
      <>
        <Reviews reviews={[{ author: 'Ana Vega', role: 'Psicóloga', quote: 'Ordenó mi agenda.', rating: 5 }]} />
        <CaseStudies items={[{ clinic: 'Centro Vida', challenge: 'Agenda en papel', result: 'Menos ausencias' }]} />
        <Team members={[{ name: 'Luis Paz', role: 'Soporte', photo: { src: '/team/luis.jpg', alt: 'Retrato de Luis Paz' } }]} />
      </>,
    );
    expect(screen.getByText('Ordenó mi agenda.')).toBeInTheDocument();
    expect(screen.getByLabelText('5 de 5 estrellas')).toBeInTheDocument();
    expect(screen.getByText('Menos ausencias')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Retrato de Luis Paz' })).toBeInTheDocument();
  });
});

describe('LocationSection', () => {
  const location = { address: 'Av. Amazonas 100', city: 'Quito', country: 'Ecuador', latitude: -0.18, longitude: -78.47, directions: 'Frente al parque.' };

  it('shows the address and a maps link without loading the embed before consent', () => {
    render(<LocationSection location={location} />);
    expect(screen.getByText(/Av. Amazonas 100/)).toBeInTheDocument();
    expect(screen.getByText('Frente al parque.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver en Google Maps' }).getAttribute('href')).toContain('-0.18,-78.47');
    expect(screen.queryByTitle('Mapa de ubicación')).not.toBeInTheDocument();
  });

  it('embeds the map after consent', () => {
    act(() => writeConsent('accepted'));
    render(<LocationSection location={location} />);
    expect(screen.getByTitle('Mapa de ubicación')).toBeInTheDocument();
  });
});
