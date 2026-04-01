import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CertificateAlert } from '../CertificateAlert';

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }));
jest.mock('../../../../lib/haptics', () => ({ haptics: { selection: jest.fn() } }));

describe('CertificateAlert', () => {
  it('renderiza título e descrição', () => {
    const { getByText } = render(<CertificateAlert onPress={() => {}} />);
    expect(getByText('Certificado digital não configurado')).toBeTruthy();
    expect(getByText(/Configure para assinar/)).toBeTruthy();
  });

  it('dispara onPress ao pressionar', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<CertificateAlert onPress={onPress} />);
    fireEvent.press(getByLabelText('Configurar certificado digital'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
