import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import type { PeriodizationPlan } from '../../types/periodization';
import { mergePlanSnapshots } from './planHelpers';

export function usePlans() {
  const [plans,setPlans] = useState<PeriodizationPlan[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const accepted = useRef(new Map<number, PeriodizationPlan>());
  useEffect(()=>{ let active=true; setLoading(true); setError(''); api.getPeriodizationPlans().then(rows=>{if(active)setPlans(mergePlanSnapshots(rows,[...accepted.current.values()]));}).catch(error=>{if(active)setError(error instanceof Error ? error.message : 'Could not load plans.');}).finally(()=>{if(active)setLoading(false);}); return ()=>{active=false;}; },[revision]);
  const retry = useCallback(()=>setRevision(value=>value+1),[]);
  const accept = (plan: PeriodizationPlan) => { accepted.current.set(plan.id,plan); setPlans(rows=>mergePlanSnapshots(rows,[plan])); setError(''); setLoading(false); };
  return {plans,loading,error,retry,accept};
}
