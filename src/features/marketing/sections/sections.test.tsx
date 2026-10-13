import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { site } from '@/content/site';
import { resetConsent, writeConsent } from '../consent/consent';
import { CaseStudies } from './case-studies';
import { FaqSection } from './faq';
import { Hero } from './hero';
import { LocationSection } from './location';
import { PlanGroups } from './plan-groups';
import { formatPlanPrice } from './plans';
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

describe('PlanGroups', () => {
  it('formats prices', () => {
    expect(formatPlanPrice(site.plans[0])).toBe('$29');
    expect(formatPlanPrice(site.plans[2])).toBe('A medida');
    expect(formatPlanPrice(site.plans[5])).toBe('A medida');
  });

  it('opens on the individual plans', () => {
    render(<PlanGroups plans={site.plans} />);
    expect(screen.getByRole('tab', { name: 'Individual' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Empresarial' })).toHaveAttribute('aria-selected', 'false');

    const panel = screen.getByRole('tabpanel', { name: 'Individual' });
    expect(within(panel).getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Individual Básico', 'Individual Pro', 'Individual Personalizado',
    ]);
    expect(within(panel).getByText('$29')).toBeInTheDocument();
    const custom = within(panel).getByRole('article', { name: 'Individual Personalizado' });
    expect(custom).toHaveTextContent('A medida');
    expect(within(custom).getByRole('link', { name: 'Hablar con ventas' })).toHaveAttribute('href', '/contacto');
  });

  it('switches to the business plans with their limits and extra-seat price', () => {
    render(<PlanGroups plans={site.plans} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Empresarial' }));

    expect(screen.getByRole('tab', { name: 'Empresarial' })).toHaveAttribute('aria-selected', 'true');
    const card = screen.getByRole('article', { name: 'Empresarial Básico' });
    expect(within(card).getByText('$99')).toBeInTheDocument();
    expect(within(card).getByText('3 usuarios incluidos')).toBeInTheDocument();
    expect(within(card).getByText('$15 por usuario adicional')).toBeInTheDocument();
    expect(within(card).getByText('Hasta 150 pacientes activos')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Individual Básico' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Empresarial Personalizado' })).toHaveTextContent('A medida');
  });

  it('keeps both groups in the page so search engines can read every plan', () => {
    const { container } = render(<PlanGroups plans={site.plans} />);
    expect(container.querySelectorAll('article')).toHaveLength(6);
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('marks the most chosen plan once per group', () => {
    render(<PlanGroups plans={site.plans} />);
    // Only the visible group's cards are exposed; the other panel is hidden.
    const marked = () => screen.getAllByRole('article')
      .filter((card) => within(card).queryByText('Más elegido'))
      .map((card) => card.getAttribute('aria-label'));
    expect(marked()).toEqual(['Individual Pro']);

    fireEvent.click(screen.getByRole('tab', { name: 'Empresarial' }));
    expect(marked()).toEqual(['Empresarial Básico']);
  });

  it('moves between the tabs with the arrow keys', () => {
    render(<PlanGroups plans={site.plans} />);
    const individual = screen.getByRole('tab', { name: 'Individual' });
    individual.focus();

    fireEvent.keyDown(individual, { key: 'ArrowRight' });
    const business = screen.getByRole('tab', { name: 'Empresarial' });
    expect(business).toHaveAttribute('aria-selected', 'true');
    expect(business).toHaveFocus();

    fireEvent.keyDown(business, { key: 'ArrowLeft' });
    expect(individual).toHaveAttribute('aria-selected', 'true');
    expect(individual).toHaveFocus();
  });

  it('labels each instance separately when rendered twice', () => {
    render(
      <>
        <PlanGroups plans={site.plans} heading="Planes" />
        <PlanGroups plans={site.plans} heading="Otra vez" />
      </>,
    );
    expect(screen.getByRole('region', { name: 'Planes' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Otra vez' })).toBeInTheDocument();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(2);
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
