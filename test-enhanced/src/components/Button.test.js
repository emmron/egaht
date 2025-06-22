import { render, screen } from '@testing-library/eghact';
import Button from './Button.egh';

describe('Button', () => {
  test('renders component', () => {
    render(Button, { 
      props: { 
        title: 'Test Title',
        description: 'Test description'
      }
    });
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });
  
  test('handles click events', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    render(Button, { props: { title: 'Test' } });
    
    const button = screen.getByRole('button');
    button.click();
    
    expect(consoleSpy).toHaveBeenCalledWith('Button clicked!');
  });
});