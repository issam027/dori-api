describe('Algorithme de priorité d\'appel (§4.4)', () => {
  it('calcule correctement les scores selon les formules et l\'exemple de référence', () => {
    // Poids et taux par défaut (§4.4)
    const baseWeightWalkin = 0;
    const baseWeightAppointment = 60;
    const escalationRateWalkin = 1;
    const escalationRateAppointment = 1;

    // Formule : score = base_weight + minutes_ecoulees * escalation_rate
    const calculateScore = (entryType: 'walkin' | 'appointment', minutesWaited: number) => {
      const base = entryType === 'appointment' ? baseWeightAppointment : baseWeightWalkin;
      const rate = entryType === 'appointment' ? escalationRateAppointment : escalationRateWalkin;
      return base + minutesWaited * rate;
    };

    // Données de l'exemple concret à 11h00 (§4.4) :
    // Client A : walk-in, ticket à 09h45 (75 min d'attente) -> 0 + 75 * 1 = 75
    const scoreA = calculateScore('walkin', 75);
    expect(scoreA).toBe(75);

    // Client B : RDV 11h00 pointé à 10h40 (0 min depuis l'heure du RDV) -> 60 + 0 * 1 = 60
    const scoreB = calculateScore('appointment', 0);
    expect(scoreB).toBe(60);

    // Client C : walk-in, ticket à 10h30 (30 min d'attente) -> 0 + 30 * 1 = 30
    const scoreC = calculateScore('walkin', 30);
    expect(scoreC).toBe(30);

    // Client D : RDV 10h30 pointé à 10h25 (30 min depuis l'heure du RDV) -> 60 + 30 * 1 = 90
    const scoreD = calculateScore('appointment', 30);
    expect(scoreD).toBe(90);

    // Ordre attendu selon §4.4 : D (90), A (75), B (60), C (30)
    const list = [
      { client: 'A', score: scoreA },
      { client: 'B', score: scoreB },
      { client: 'C', score: scoreC },
      { client: 'D', score: scoreD },
    ].sort((a, b) => b.score - a.score);

    expect(list.map((x) => x.client)).toEqual(['D', 'A', 'B', 'C']);
  });
});
