import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Status, Table, KeyValue } from '../src/components/ui';
import { ConfirmDialog } from '../src/components/ui/dialog';
import { KoboInput } from '../src/components/ui/forms';

describe('Status', () => {
  it('always renders a text label (never colour alone)', () => {
    render(<Status value="pending_review" />);
    expect(screen.getByText('Pending review')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('requires a reason of at least 5 characters before confirming', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Reject?" requireReason onClose={() => {}} onConfirm={onConfirm} confirmLabel="Reject" />);
    const btn = screen.getByRole('button', { name: 'Reject' });
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Reason'), 'abc');
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Reason'), ' details');
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledWith('abc details');
  });
});

describe('KoboInput', () => {
  function Harness({ onValue }) {
    const [v, setV] = useState(0);
    return <MemoryRouter><KoboInput label="Amount" value={v} onChange={(k) => { setV(k); onValue(k); }} /></MemoryRouter>;
  }
  it('emits exact integer kobo for typed naira', async () => {
    const seen = [];
    render(<Harness onValue={(k) => seen.push(k)} />);
    await userEvent.type(screen.getByLabelText('Amount'), '1,234.56');
    expect(seen.at(-1)).toBe(123456);
    expect(screen.getByLabelText('Amount')).toHaveValue('1,234.56');
  });
  it('flags input that is not a valid amount', async () => {
    render(<Harness onValue={() => {}} />);
    await userEvent.type(screen.getByLabelText('Amount'), '1.234');
    expect(screen.getByText(/Enter an amount like/)).toBeInTheDocument();
  });
});

describe('Table and KeyValue', () => {
  it('shows the empty state when there are no rows', () => {
    render(<Table caption="X" rows={[]} columns={[]} empty={<p>Nothing yet</p>} />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
  });
  it('skips falsy KeyValue rows', () => {
    render(<KeyValue items={[['A', '1'], null, false, ['B', '2']]} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
