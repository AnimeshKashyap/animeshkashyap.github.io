import { ThemeProvider } from './theme/ThemeProvider';
import { NetworkBackground } from './components/NetworkBackground/NetworkBackground';
import { NavBar } from './components/NavBar/NavBar';
import { Hero } from './components/Hero/Hero';
import { About } from './components/About/About';
import { Skills } from './components/Skills/Skills';
import { Experience } from './components/Experience/Experience';
import { Projects } from './components/Projects/Projects';
import { Education } from './components/Education/Education';
import { Contact } from './components/Contact/Contact';
import { Footer } from './components/Footer/Footer';
import styles from './App.module.css';

function App() {
  return (
    <ThemeProvider>
      <NetworkBackground />
      <NavBar />
      <Hero />
      <main className={styles.sections}>
        <About />
        <Skills />
        <Experience />
        <Projects />
        <Education />
        <Contact />
      </main>
      <Footer />
    </ThemeProvider>
  );
}

export default App;
