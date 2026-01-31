import React from 'react';
import { FOX_AVATAR_BASE64 } from './components/voxel/avatarData.ts';

const FoxPage: React.FC = () => {
  return (
    <div style={{ margin: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f0f0' }}>
      <img 
        src={FOX_AVATAR_BASE64} 
        style={{ maxWidth: '100%', height: 'auto' }} 
        alt="Fox Avatar"
      />
    </div>
  );
};

export default FoxPage;