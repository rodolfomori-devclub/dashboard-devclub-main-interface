// src/components/CompareButton.jsx
import React from 'react';
import { Button, Tooltip } from '@mui/material';
import { CompareArrows } from '@mui/icons-material';

/**
 * Botão para comparar lançamentos
 * @param {Object} props
 * @param {function} props.onClick - Função a ser executada quando o botão for clicado
 * @param {string} props.selectedLaunch - Nome do lançamento atualmente selecionado
 * @param {boolean} props.disabled - Se o botão deve estar desabilitado
 */
const CompareButton = ({ onClick, selectedLaunch, disabled }) => {
  return (
    <Tooltip 
      title={selectedLaunch 
        ? `Comparar ${selectedLaunch} com outro lançamento` 
        : "Selecione um lançamento para comparar"}
    >
      <span>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<CompareArrows />}
          onClick={onClick}
          disabled={disabled || !selectedLaunch}
          sx={{
            ml: 2,
            borderColor: 'primary.main',
            color: 'primary.main',
            '&:hover': {
              borderColor: 'primary.dark',
              backgroundColor: 'rgba(55, 227, 89, 0.08)',
            }
          }}
        >
          Comparar
        </Button>
      </span>
    </Tooltip>
  );
};

export default CompareButton;