exports.login = (req, res) => {
  const { email, password } = req.body;

  // Exemplo simples (troque para validação real depois)
  if (email === 'admin@teste.com' && password === '123456') {
    res.json({ status: 'OK' });
  } else {
    res.status(401).json({ status: 'FAIL', message: 'Credenciais inválidas' });
  }
};
