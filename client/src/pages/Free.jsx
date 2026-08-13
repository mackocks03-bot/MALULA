import DashboardLayout from '../components/DashboardLayout.jsx';
import { useLanguage } from '../contexts/LanguageContext.jsx';

const MOVIES = [
    { title: 'Night of the Living Dead', id: 'night_of_the_living_dead', year: 1968 },
    { title: 'Nosferatu', id: 'nosferatu_1922', year: 1922 },
    { title: 'His Girl Friday', id: 'His_Girl_Friday', year: 1940 },
    { title: 'Charade', id: 'Charade_1963', year: 1963 }
];

export default function Free() {
    const { translate } = useLanguage();

    return (
        <DashboardLayout>
            <div className="dashboard-container">
                <div className="dashboard-content">
                    <h2 className="page-title">{translate('free.title')}</h2>
                    <p className="auth-subtitle">{translate('free.subtitle') || 'Public domain movies from Archive.org'}</p>

                    <div className="movies-grid">
                        {MOVIES.map(movie => (
                            <div key={movie.id} className="movie-card">
                                <div className="movie-info">
                                    <h3>{movie.title}</h3>
                                    <span className="year">{movie.year}</span>
                                </div>
                                <iframe
                                    title={movie.title}
                                    src={`https://archive.org/embed/${movie.id}`}
                                    width="100%"
                                    height="200"
                                    frameBorder="0"
                                    allowFullScreen
                                    style={{ borderRadius: 12, marginTop: 8 }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
