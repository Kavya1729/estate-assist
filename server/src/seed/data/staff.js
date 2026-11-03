import { ROLES } from '../../constants/domain.js';

/** Demo accounts. `projects` lists the project codes an executive covers. */
export const STAFF = [
  {
    key: 'meera',
    name: 'Meera Desai',
    email: 'meera.desai@example.com',
    role: ROLES.SALES_HEAD,
    projects: [],
  },
  {
    key: 'ravi',
    name: 'Ravi Mehta',
    email: 'ravi.mehta@example.com',
    role: ROLES.SALES_EXECUTIVE,
    projects: ['P1'],
  },
  {
    key: 'amit',
    name: 'Amit Rana',
    email: 'amit.rana@example.com',
    role: ROLES.SALES_EXECUTIVE,
    projects: ['P1', 'P2'],
  },
  {
    key: 'pooja',
    name: 'Pooja Trivedi',
    email: 'pooja.trivedi@example.com',
    role: ROLES.SALES_EXECUTIVE,
    projects: ['P2'],
  },
  {
    key: 'sanjay',
    name: 'Sanjay Parmar',
    email: 'sanjay.parmar@example.com',
    role: ROLES.SALES_EXECUTIVE,
    projects: ['P2'],
  },
];
